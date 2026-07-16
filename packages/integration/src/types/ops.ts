import type { FailureKind } from "./enums";
import type { JsonValue } from "./json";
import type { HttpExchange } from "./log";

/**
 * Parameters of an outbound dry run; empty `script` falls back to the saved adapter.
 */
export interface DryRunParams {
  systemCode: string;
  contractCode: string;
  script?: string;
  input?: JsonValue;
}

/**
 * Outcome of an outbound dry run. The trace is populated even when the run
 * failed, so operators see how far the script got. Mirrors the Go
 * `exec.DryRunResult`.
 */
export interface DryRunResult {
  output: JsonValue;
  trace: HttpExchange[] | null;
  failureKind?: FailureKind | "";
  error?: string;
}

/**
 * The synthetic vendor request of an inbound dry run.
 */
export interface InboundRequestInput {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: string;
}

/**
 * Parameters of an inbound dry run; `handlerOutput` is the stubbed handler's sample.
 */
export interface DryRunInboundParams {
  systemCode: string;
  contractCode: string;
  script?: string;
  request: InboundRequestInput;
  handlerOutput?: JsonValue;
}

/**
 * Outcome of an inbound dry run: the reply the vendor would receive plus what
 * the script dispatched, so both translation directions are verified at once.
 * Mirrors the Go `exec.InboundDryRunResult`.
 */
export interface InboundDryRunResult {
  reply: JsonValue;
  dispatchedInput: JsonValue;
  failureKind?: FailureKind | "";
  error?: string;
}

/**
 * Parameters of a connection probe against a saved system.
 */
export interface TestConnectionParams {
  systemCode: string;
  method?: string;
  path?: string;
}

/**
 * One probe request against the system base URL.
 */
export interface HttpProbe {
  reachable: boolean;
  status?: number;
  statusText?: string;
  durationMs: number;
  error?: string;
}

/**
 * One throwaway connection against the system data source.
 */
export interface DatabaseProbe {
  reachable: boolean;
  version?: string;
  durationMs: number;
  error?: string;
}

/**
 * The outcome of probing a system's configured transports; each probe is
 * present iff the system configures that transport. Mirrors the Go
 * `exec.ConnectionCheck`.
 */
export interface ConnectionCheck {
  http?: HttpProbe;
  database?: DatabaseProbe;
}
