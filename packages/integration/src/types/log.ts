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
}

/**
 * One recorded invocation: its classification, timing, and the masked,
 * size-capped captures. Read-only. Mirrors the Go `integration.InvocationLog`.
 * `failureKind` is empty for a successful invocation.
 */
export interface InvocationLog extends CreationAudited {
  systemCode: string;
  contractCode: string;
  direction: Direction;
  failureKind?: FailureKind | "";
  durationMs: number;
  input?: JsonValue;
  output?: JsonValue;
  httpTrace?: HttpExchange[] | null;
  error?: string | null;
  requestId: string;
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
