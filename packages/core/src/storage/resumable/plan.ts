import type { GenericAbortSignal } from "axios";

import type { ListedPart, ProtocolContext } from "../protocol";
import type { ResumablePersistence, ResumeRecord } from "./persistence";

import { abortUpload, listParts } from "../protocol";

/**
 * Inputs collected for a potential resume; passed to the
 * `onResumeDetected` callback so the UI layer can decide whether to
 * continue the previous session or discard it.
 *
 * `completedParts` is the live result of `list_parts`, NOT a value
 * retrieved from disk — the backend is the source of truth. The record
 * is included so the UI can show context ("you uploaded N MiB of
 * <filename> two hours ago, resume?").
 */
export interface ResumeCandidate {
  record: ResumeRecord;
  completedParts: ListedPart[];
}

/**
 * Caller decision on whether to honor a `ResumeCandidate`. A discriminated
 * union so future intents (e.g. "resume but rename target", "fork into a
 * new claim") can be added without changing the callback signature.
 */
export type ResumeDecision
  = | { kind: "resume" }
    | { kind: "discard" };

/**
 * Final resume plan handed to `Uploader.start(plan)`. The Uploader
 * branches on `kind`:
 *
 * - `fresh`: behave as before — call `init_upload`, upload every part.
 * - `resume`: skip `init_upload`, treat `completedParts` as the set of
 * part numbers (with their server-recorded sizes) to bypass during
 * the worker loop.
 *
 * `expiresAt` is carried through so consumers downstream of the
 * Uploader (notably `useUpload`'s persistence layer) can refresh the
 * stored record with the original authoritative expiry rather than
 * re-deriving it.
 */
export type ResumePlan
  = | { kind: "fresh" }
    | {
      kind: "resume";
      claimId: string;
      key: string;
      partSize: number;
      partCount: number;
      expiresAt: string;
      completedParts: readonly ListedPart[];
    };

/**
 * Caller's decision handler. Receives the candidate (record + live
 * completed parts) and returns the decision. The default — when the
 * caller does not provide one — is `{ kind: "discard" }`, because a
 * resume that picks the wrong file is far worse than a redundant
 * fresh upload.
 */
export type ResumeDecisionHandler = (candidate: ResumeCandidate) => Promise<ResumeDecision>;

/**
 * Inputs to `resolveResumePlan`. The caller is responsible for
 * computing the fingerprint (so it can also use it elsewhere, e.g.
 * to write the resume record after the upload starts) — the planner
 * only consumes the resulting string.
 */
export interface ResolveResumeInputs {
  fingerprint: string;
  persistence: ResumablePersistence;
  /**
   * Protocol context carrying the HttpClient and RPC routing details.
   * Same shape as the one passed to `initUpload` / `uploadPart` / etc.
   */
  ctx: ProtocolContext;
  /**
   * Defaults to `() => ({ kind: "discard" })`. Callers MUST provide a
   * handler if they want resume to actually happen.
   */
  onResumeDetected?: ResumeDecisionHandler;
  /**
   * Optional cancellation signal for the in-flight `list_parts` / abort
   * calls. Without it the planner blocks the caller until the network
   * request settles — a slow server or hung connection makes
   * `uploader.abort()` useless during the resume-detection phase.
   */
  signal?: GenericAbortSignal;
}

/**
 * Compute the `ResumePlan` for a given fingerprint:
 *
 * 1. Look up the persisted record; on miss → `fresh`.
 * 2. Validate the record's expiry against the wall clock; on expiry →
 * remove + `fresh`.
 * 3. Call `list_parts` to get the authoritative completed-parts list;
 * on protocol error → remove + `fresh` (the claim is likely gone
 * server-side).
 * 4. Hand the candidate to `onResumeDetected`; honor the returned
 * decision.
 *
 * A `discard` decision removes the local record first, then issues a
 * best-effort `abort_upload`. Local-state cleanup is ordered first so
 * a process crash between the two steps cannot leave a record that
 * outlives its backend claim.
 */
export async function resolveResumePlan(inputs: ResolveResumeInputs): Promise<ResumePlan> {
  const {
    fingerprint,
    persistence,
    ctx,
    onResumeDetected = discardByDefault,
    signal
  } = inputs;

  const record = await persistence.load(fingerprint);

  if (!record) {
    return { kind: "fresh" };
  }

  // Client-side expiry check avoids a round trip when we already know
  // the claim is dead. The server is still the authority — `list_parts`
  // below will reject expired claims even if the client clock is wrong.
  if (isExpired(record.expiresAt)) {
    await persistence.remove(fingerprint);
    return { kind: "fresh" };
  }

  let completed: ListedPart[];

  try {
    const response = await listParts(ctx, record.claimId, signal);
    completed = response.parts;
  } catch {
    // Treat any list_parts failure as "cannot resume" — most likely the
    // claim was swept server-side. Drop the record so future attempts
    // do not keep retrying a doomed lookup.
    await persistence.remove(fingerprint);
    return { kind: "fresh" };
  }

  const decision = await onResumeDetected({ record, completedParts: completed });

  if (decision.kind === "discard") {
    // Drop the local record before issuing the abort: if the process
    // dies between the two calls, the orphaned backend claim will be
    // reaped by the sweeper, but an orphaned local record would keep
    // pointing at a dead claim across reboots.
    await persistence.remove(fingerprint);
    await abortUpload(ctx, record.claimId);
    return { kind: "fresh" };
  }

  return {
    kind: "resume",
    claimId: record.claimId,
    key: record.key,
    partSize: record.partSize,
    partCount: record.partCount,
    expiresAt: record.expiresAt,
    completedParts: completed
  };
}

function discardByDefault(): Promise<ResumeDecision> {
  return Promise.resolve({ kind: "discard" });
}

function isExpired(isoString: string): boolean {
  const expiresAtMs = Date.parse(isoString);

  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= Date.now();
}
