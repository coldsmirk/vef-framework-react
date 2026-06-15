import type { Awaitable, MaybeUndefined } from "@vef-framework-react/shared";

import type { AuthTokens } from "../http";

/**
 * SSE client options.
 */
export interface SseClientOptions {
  /**
   * Retrieve auth tokens (optional, used to auto-inject Authorization header).
   */
  getAuthTokens?: () => Awaitable<MaybeUndefined<Readonly<Pick<AuthTokens, "accessToken">>>>;
  /**
   * Whether to enable automatic retries.
   *
   * @default true
   */
  enableRetry?: boolean;
  /**
   * Maximum retry attempts.
   *
   * @default 3
   */
  maxRetries?: number;
  /**
   * Optional error message handler.
   */
  showErrorMessage?: (message: string) => void;
  /**
   * Callback when token expires (401 response).
   * Return true if token was refreshed and request should be retried.
   * Return false to abort the request.
   */
  onTokenExpired?: () => Awaitable<boolean>;
}

/**
 * SSE request configuration.
 */
export interface SseRequestConfig {
  /**
   * Request URL.
   */
  url: string;
  /**
   * HTTP method.
   *
   * @default "POST"
   */
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /**
   * Request headers.
   */
  headers?: Record<string, string>;
  /**
   * Request body (POST/PUT only).
   */
  body?: string | object;
  /**
   * AbortSignal for canceling the request.
   */
  signal?: AbortSignal;
}

/**
 * SSE message event.
 */
export interface SseMessageEvent {
  /**
   * Event ID.
   */
  id?: string;
  /**
   * Event type.
   */
  event?: string;
  /**
   * Message data.
   */
  data: string;
}

/**
 * SSE event handlers.
 */
export interface SseEventHandlers {
  /**
   * Connection opened callback.
   */
  onOpen?: (response: Response) => Awaitable<void>;
  /**
   * Message received callback.
   */
  onMessage: (event: SseMessageEvent) => void;
  /**
   * Error callback.
   */
  onError?: (error: Error) => void;
  /**
   * Connection closed callback.
   */
  onClose?: () => void;
}
