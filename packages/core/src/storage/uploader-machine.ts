import type { ResumePlan } from "./resumable/plan";

import { assertEvent, fromPromise, setup } from "xstate";

/**
 * Side-effect surface the uploader statechart drives. The machine owns the
 * lifecycle only — every phase runner closes over the `Uploader` instance
 * that supplies it, so the chart stays a pure, domain-free transition table.
 */
export interface UploaderMachineDeps {
  /**
   * Open (fresh) or synthesise (resume) the multipart session and seed the
   * uploader's bookkeeping. Rejection means the session never opened.
   */
  prepareSession: (plan: ResumePlan) => Promise<void>;
  /**
   * Stream every pending part through the worker pool. Rejection carries the
   * first terminal worker error.
   */
  uploadParts: () => Promise<void>;
  /**
   * Finalize the multipart session and capture the upload result.
   */
  completeSession: () => Promise<void>;
  /**
   * Best-effort backend `abort_upload`. Must never reject for control flow —
   * the machine lands in `aborted` either way.
   */
  abortSession: () => Promise<void>;
  /**
   * Abort the shared transport controller so in-flight HTTP requests and
   * pending retry backoffs unwind immediately.
   */
  killTransport: () => void;
  /**
   * Record the error a phase rejected with; `start()` rejects with it once
   * the machine reaches `failed`.
   */
  recordFailure: (error: unknown) => void;
  /**
   * Whether an abort was latched before the run started (external signal
   * already aborted, or `abort()` called while still idle).
   */
  abortRequested: () => boolean;
}

export type UploaderEvent
  = | { type: "START"; plan: ResumePlan }
    | { type: "ABORT" };

/**
 * Lifecycle statechart behind `Uploader`. State names are exactly the public
 * `UploadStatus` values — the chart IS the documented contract in
 * `./types.ts`, and `Uploader` maps snapshots to statuses by name.
 *
 * Cancellation is an *event channel* (`ABORT`), not an error-instance check:
 * a phase rejection always means failure (`onError` → `failed`, session kept
 * alive for resume), while a caller abort always transitions to `aborting`
 * (backend session torn down). The two can no longer be confused, even when
 * the worker pool trips the shared controller itself to stop sibling workers
 * after a terminal part failure.
 */
export function createUploaderMachine(deps: UploaderMachineDeps) {
  return setup({
    types: {
      events: {} as UploaderEvent
    },
    actors: {
      prepareSession: fromPromise<void, ResumePlan>(({ input }) => deps.prepareSession(input)),
      uploadParts: fromPromise(() => deps.uploadParts()),
      completeSession: fromPromise(() => deps.completeSession()),
      abortSession: fromPromise(() => deps.abortSession())
    },
    actions: {
      killTransport: () => {
        deps.killTransport();
      },
      recordFailure: (_, params: { error: unknown }) => {
        deps.recordFailure(params.error);
      }
    },
    guards: {
      abortRequested: () => deps.abortRequested()
    }
  }).createMachine({
    id: "uploader",
    initial: "idle",
    states: {
      idle: {
        on: {
          START: [
            { guard: "abortRequested", target: "aborting" },
            { target: "initializing" }
          ]
        }
      },
      initializing: {
        invoke: {
          src: "prepareSession",
          input: ({ event }) => {
            assertEvent(event, "START");
            return event.plan;
          },
          onDone: { target: "uploading" },
          onError: {
            target: "failed",
            actions: { type: "recordFailure", params: ({ event }) => { return { error: event.error }; } }
          }
        },
        on: { ABORT: { target: "aborting" } }
      },
      uploading: {
        invoke: {
          src: "uploadParts",
          onDone: { target: "completing" },
          onError: {
            target: "failed",
            actions: { type: "recordFailure", params: ({ event }) => { return { error: event.error }; } }
          }
        },
        on: { ABORT: { target: "aborting" } }
      },
      completing: {
        invoke: {
          src: "completeSession",
          onDone: { target: "succeeded" },
          onError: {
            target: "failed",
            actions: { type: "recordFailure", params: ({ event }) => { return { error: event.error }; } }
          }
        },
        on: { ABORT: { target: "aborting" } }
      },
      aborting: {
        entry: "killTransport",
        invoke: {
          src: "abortSession",
          onDone: { target: "aborted" },
          onError: { target: "aborted" }
        }
      },
      succeeded: { type: "final" },
      failed: { type: "final" },
      aborted: { type: "final" }
    }
  });
}
