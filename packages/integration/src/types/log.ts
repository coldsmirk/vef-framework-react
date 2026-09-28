import type { CreationAudited } from "./base";
import type { Direction, FailureKind } from "./enums";
import type { JsonValue } from "./json";

/**
 * One wire exchange captured while an adapter script ran, shared by invocation
 * logs and the dry-run trace. Bodies and header values arrive masked and
 * truncated. Mirrors the Go `integration.HTTPExchange`.
 */
export interface HttpExchange {
  method: string;
  url: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  durationMs: number;
  error?: string;
  /**
   * The caller's network address; only inbound deliveries carry one.
   */
  clientAddr?: string;
}

/**
 * The outcome of one run — recorded or replayed — with its classification,
 * timing, and masked, size-capped captures. `failureKind` is empty for a
 * successful run.
 */
export interface InvocationOutcome {
  failureKind?: FailureKind | "";
  durationMs: number;
  input?: JsonValue;
  output?: JsonValue;
  httpTrace?: HttpExchange[] | null;
  error?: string | null;
}

/**
 * One recorded invocation. Read-only. Mirrors the Go `integration.InvocationLog`.
 */
export interface InvocationLog extends CreationAudited, InvocationOutcome {
  systemCode: string;
  contractCode: string;
  direction: Direction;
  requestId: string;
  /**
   * Whether a replay payload was kept (`vef.integration.log.replay`), so the
   * invocation can be re-run.
   */
  replayable: boolean;
}

/**
 * Parameters of a replay; `script` runs unsaved editor content in place of the
 * saved adapter script.
 */
export interface ReplayParams {
  id: string;
  script?: string;
}

/**
 * The outcome of re-running a recorded invocation against the current
 * definitions, shaped like the log entry it is compared with. Mirrors the Go
 * `exec.ReplayResult`.
 */
export interface ReplayResult extends InvocationOutcome {
  /**
   * The contract, system, or adapter was modified after the original
   * invocation, so a different outcome may stem from that edit.
   */
  definitionChanged: boolean;
}

/**
 * Search parameters for invocation logs.
 */
export interface LogSearch {
  systemCode?: string;
  contractCode?: string;
  direction?: Direction;
  failureKind?: FailureKind;
  requestId?: string;
}
