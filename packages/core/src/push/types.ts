import type { Awaitable, MaybeUndefined } from "@vef-framework-react/shared";

import type { AuthTokens } from "../http";

/**
 * Close code sent when the connection's login session was revoked (logout,
 * concurrent-login eviction, administrative kick) or expired. Terminal: the
 * client must not reconnect and should enter its logged-out flow.
 */
export const PUSH_CLOSE_SESSION_INVALID = 4401;

/**
 * Close code sent when the per-user connection cap was reached. Terminal: the
 * client must not retry until another connection closes.
 */
export const PUSH_CLOSE_TOO_MANY_CONNECTIONS = 4429;

/**
 * The wire envelope every push message arrives in (one JSON text frame).
 */
export interface PushMessage<TPayload = unknown> {
  /**
   * Server-generated message id, stable across recipients.
   */
  id: string;
  /**
   * Business-defined discriminator handlers subscribe on.
   */
  type: string;
  /**
   * Arbitrary JSON payload; absent when the server sent none.
   */
  payload?: TPayload;
  /**
   * Server-side send time (RFC 3339).
   */
  time: string;
}

/**
 * Push connection lifecycle status.
 */
export type PushStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

/**
 * Reconnect backoff configuration. Only transport-level failures reconnect;
 * terminal close codes (4401 / 4429) and an explicit `close()` never do.
 */
export interface PushReconnectOptions {
  /**
   * Whether to reconnect after a transport-level loss.
   *
   * @default true
   */
  enabled?: boolean;
  /**
   * First retry delay in milliseconds; doubles per attempt.
   *
   * @default 1000
   */
  initialDelay?: number;
  /**
   * Upper bound for the retry delay in milliseconds.
   *
   * @default 30000
   */
  maxDelay?: number;
}

/**
 * Push message handler.
 */
export type PushMessageHandler<TPayload = unknown> = (message: PushMessage<TPayload>) => void;

/**
 * Push client options.
 */
export interface PushClientOptions {
  /**
   * Push endpoint URL. Accepts ws(s):// or http(s):// (converted), absolute
   * or relative (resolved against the current origin).
   *
   * @default "/ws"
   */
  url?: string;
  /**
   * Retrieve auth tokens. The access token rides the `__accessToken` query
   * parameter — a browser WebSocket cannot set an Authorization header — and
   * is re-read from here on every (re)connect attempt, so a refreshed token
   * is picked up automatically.
   */
  getAuthTokens?: () => Awaitable<MaybeUndefined<Readonly<Pick<AuthTokens, "accessToken">>>>;
  /**
   * Reconnect backoff configuration.
   */
  reconnect?: PushReconnectOptions;
  /**
   * Called when the server closes with 4401 (session revoked or expired).
   * The client will not reconnect; route the user to the logged-out flow.
   */
  onSessionInvalid?: (event: CloseEvent) => void;
  /**
   * Called when the server refuses the connection with 4429 (per-user
   * connection cap). The client will not retry automatically.
   */
  onConnectionRejected?: (event: CloseEvent) => void;
  /**
   * Observes connection status transitions.
   */
  onStatusChange?: (status: PushStatus) => void;
}
