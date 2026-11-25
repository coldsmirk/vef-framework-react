/**
 * Per-form coordinator for effect action sequences:
 *
 * - **Single-flight** per `(scopeId, ownerKey, ruleId)`: re-triggering the
 * same rule on the same node in the same value scope aborts the prior run's
 * `AbortController`, while different owners (two fields sharing a rule id or
 * missing-id fallback), different rules, or different subform rows run
 * independently.
 * - **Abort boundaries**: `abortScope(scopeId)` on subform row unmount,
 * `abortAll()` on external form reset or form unmount, and
 * `abortOthers(keepRunId)` when a sequence's own `reset` step runs so its
 * subsequent actions continue.
 * - **Busy state**: reference-counted per `(scopeId, fieldId)` so only the
 * field whose sequence has an in-flight request renders a loading mark (zero
 * unrelated field re-renders via `useSyncExternalStore`).
 * - **Submit gate**: tracks runs holding an active request (and any subsequent
 * synchronous writes before settlement) so submission waits for them before
 * validating. A run calls `leaveSubmitGate()` as soon as it reaches its own
 * `submit` step (its prior requests have already completed), eliminating
 * deadlocks when multiple `api_call → submit` sequences run concurrently.
 */

export interface SequenceRunHandle {
  readonly runId: number;
  readonly signal: AbortSignal;
  /**
   * Mark this run as holding an active remote request. Increments the owning
   * field's busy counter (when `busyKey` is set) and registers the run with
   * the submit gate until `leaveSubmitGate()`, `finish()`, or abort. Returns
   * an idempotent disposer to decrement the busy counter once the request
   * settles.
   */
  beginRequest: (busyKey: string | undefined) => () => void;
  /**
   * Remove this run from the submit gate without settling its single-flight
   * slot or aborting it. Called right before a sequence executes its own
   * `submit` step so concurrent `api_call → submit` runs never wait on each
   * other.
   */
  leaveSubmitGate: () => void;
  /**
   * Release single-flight slot, pending-request gate, and any remaining busy
   * counts for this run. Idempotent.
   */
  finish: () => void;
}

interface ActiveRun {
  readonly runId: number;
  readonly scopeId: string;
  readonly slotKey: string;
  readonly abortController: AbortController;
  requestGate: PromiseWithResolvers<void> | null;
  readonly heldBusyKeys: Map<string, number>;
  settled: boolean;
}

export class SequenceController {
  private nextRunId = 0;
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly runsByScope = new Map<string, Set<ActiveRun>>();
  private readonly pendingRequestRuns = new Map<number, Promise<void>>();
  private readonly busyCounts = new Map<string, number>();
  private readonly busyListeners = new Set<() => void>();

  subscribeBusy = (listener: () => void): () => void => {
    this.busyListeners.add(listener);

    return () => {
      this.busyListeners.delete(listener);
    };
  };

  private releaseRequestGate(run: ActiveRun): void {
    this.pendingRequestRuns.delete(run.runId);

    const gate = run.requestGate;

    if (gate !== null) {
      run.requestGate = null;
      gate.resolve();
    }
  }

  private abortRun(run: ActiveRun): void {
    this.settleRun(run);

    if (!run.abortController.signal.aborted) {
      run.abortController.abort();
    }
  }

  private settleRun(run: ActiveRun): void {
    if (run.settled) {
      return;
    }

    run.settled = true;

    if (this.activeRuns.get(run.slotKey) === run) {
      this.activeRuns.delete(run.slotKey);
    }

    const scopeRuns = this.runsByScope.get(run.scopeId);

    if (scopeRuns !== undefined) {
      scopeRuns.delete(run);

      if (scopeRuns.size === 0) {
        this.runsByScope.delete(run.scopeId);
      }
    }

    if (run.heldBusyKeys.size > 0) {
      for (const [key, count] of run.heldBusyKeys) {
        this.adjustBusyCount(key, -count);
      }

      run.heldBusyKeys.clear();
    }

    this.releaseRequestGate(run);
  }

  private adjustBusyCount(key: string, delta: number): void {
    const previous = this.busyCounts.get(key) ?? 0;
    const next = Math.max(0, previous + delta);

    if (next === previous) {
      return;
    }

    if (next === 0) {
      this.busyCounts.delete(key);
    } else {
      this.busyCounts.set(key, next);
    }

    for (const listener of this.busyListeners) {
      listener();
    }
  }

  startRun(scopeId: string, ownerKey: string, ruleId: string): SequenceRunHandle {
    const slotKey = `${scopeId}\0${ownerKey}\0${ruleId}`;
    const existing = this.activeRuns.get(slotKey);

    if (existing !== undefined) {
      this.abortRun(existing);
    }

    const run: ActiveRun = {
      runId: ++this.nextRunId,
      scopeId,
      slotKey,
      abortController: new AbortController(),
      requestGate: null,
      heldBusyKeys: new Map(),
      settled: false
    };

    this.activeRuns.set(slotKey, run);

    let scopeRuns = this.runsByScope.get(scopeId);

    if (scopeRuns === undefined) {
      scopeRuns = new Set();
      this.runsByScope.set(scopeId, scopeRuns);
    }

    scopeRuns.add(run);

    return {
      runId: run.runId,
      signal: run.abortController.signal,
      beginRequest: busyKey => {
        if (run.settled || run.abortController.signal.aborted) {
          return () => {
            // Already settled; nothing to release.
          };
        }

        if (run.requestGate === null) {
          const gate = Promise.withResolvers<void>();

          run.requestGate = gate;
          this.pendingRequestRuns.set(run.runId, gate.promise);
        }

        let released = false;

        if (busyKey !== undefined) {
          this.adjustBusyCount(busyKey, 1);
          run.heldBusyKeys.set(busyKey, (run.heldBusyKeys.get(busyKey) ?? 0) + 1);
        }

        return () => {
          if (released) {
            return;
          }

          released = true;

          if (busyKey !== undefined) {
            const held = run.heldBusyKeys.get(busyKey) ?? 0;

            if (held > 0) {
              if (held === 1) {
                run.heldBusyKeys.delete(busyKey);
              } else {
                run.heldBusyKeys.set(busyKey, held - 1);
              }

              this.adjustBusyCount(busyKey, -1);
            }
          }
        };
      },
      leaveSubmitGate: () => {
        this.releaseRequestGate(run);
      },
      finish: () => {
        this.settleRun(run);
      }
    };
  }

  hasActiveRuns(scopeId: string): boolean {
    const scopeRuns = this.runsByScope.get(scopeId);

    return scopeRuns !== undefined && scopeRuns.size > 0;
  }

  abortScope(scopeId: string): void {
    const scopeRuns = this.runsByScope.get(scopeId);

    if (scopeRuns === undefined) {
      return;
    }

    const snapshot = [...scopeRuns];

    for (const run of snapshot) {
      this.abortRun(run);
    }
  }

  abortOthers(keepRunId: number): void {
    const snapshot = this.activeRuns.values().toArray();

    for (const run of snapshot) {
      if (run.runId !== keepRunId) {
        this.abortRun(run);
      }
    }
  }

  abortAll(): void {
    const snapshot = this.activeRuns.values().toArray();

    for (const run of snapshot) {
      this.abortRun(run);
    }
  }

  getBusyCount(scopeId: string, fieldId: string): number {
    return this.busyCounts.get(busyKeyFor(scopeId, fieldId)) ?? 0;
  }

  hasPendingRequests(): boolean {
    return this.pendingRequestRuns.size > 0;
  }

  async waitForPendingRequests(): Promise<void> {
    while (this.pendingRequestRuns.size > 0) {
      await Promise.allSettled(this.pendingRequestRuns.values());
    }
  }
}

export function busyKeyFor(scopeId: string, fieldId: string): string {
  return `${scopeId}\0${fieldId}`;
}
