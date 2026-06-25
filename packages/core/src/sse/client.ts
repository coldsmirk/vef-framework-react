import type { SseClientOptions, SseEventHandlers, SseRequestConfig } from "./types";

import { fetchEventSource } from "@microsoft/fetch-event-source";
import { isString } from "@vef-framework-react/shared";
import { createActor } from "xstate";

import { createStreamMachine, TokenExpiredError } from "./stream-machine";

/**
 * Check if a header exists (case-insensitive).
 */
function hasHeader(headers: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  return Object.keys(headers).some(key => key.toLowerCase() === target);
}

/**
 * Serialize request body to string.
 */
function serializeBody(
  body: string | object | undefined,
  headers: Record<string, string>
): string | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (isString(body)) {
    return body;
  }

  if (!hasHeader(headers, "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  return JSON.stringify(body);
}

/**
 * SSE client wrapper around `@microsoft/fetch-event-source`.
 *
 * Each `stream()` call runs the session statechart in `./stream-machine.ts`
 * (attempt → token refresh → one retry); this class supplies the connection
 * attempt itself and the token-refresh callback. Reconnects *within* an
 * attempt stay inside `fetch-event-source`, which owns `Last-Event-ID`
 * continuity and server-driven retry intervals.
 */
export class SseClient {
  readonly #options: Required<Pick<SseClientOptions, "enableRetry" | "maxRetries">> & SseClientOptions;
  readonly #controllers = new Set<AbortController>();

  constructor(options: SseClientOptions = {}) {
    this.#options = {
      enableRetry: true,
      maxRetries: 3,
      ...options
    };
  }

  /**
   * Start an SSE stream request. Resolves when the stream ends — normally,
   * by abort, or after a reported auth failure; rejects with the original
   * error when the stream fails past its retry budget.
   */
  stream(config: SseRequestConfig, handlers: SseEventHandlers): Promise<void> {
    let failure: unknown;

    const actor = createActor(createStreamMachine({
      runAttempt: () => this.#runAttempt(config, handlers),
      refreshToken: () => this.#tryTokenRefresh(),
      reportAuthFailure: () => {
        const error = new Error("Authentication failed: token expired");
        handlers.onError?.(error);
        this.#options.showErrorMessage?.(error.message);
      },
      recordFailure: error => {
        failure = error;
      }
    }));

    return new Promise<void>((resolve, reject) => {
      actor.subscribe(snapshot => {
        if (snapshot.status !== "done") {
          return;
        }

        if (snapshot.value === "failed") {
          // Reject with the original instance — callers discriminate on it.
          reject(failure);
          return;
        }

        resolve();
      });
      actor.start();
    });
  }

  /**
   * Abort all active stream requests.
   */
  abort(): void {
    for (const controller of this.#controllers) {
      controller.abort();
    }

    this.#controllers.clear();
  }

  /**
   * One connection attempt: prepare headers, open the event source, pump
   * events until the stream ends. Throws `TokenExpiredError` upward so the
   * statechart can route through the refresh path.
   */
  async #runAttempt(config: SseRequestConfig, handlers: SseEventHandlers): Promise<void> {
    const abortController = new AbortController();
    this.#controllers.add(abortController);

    const cleanupExternalAbort = this.#linkExternalSignal(config.signal, abortController);

    let retryCount = 0;

    try {
      const headers = await this.#prepareHeaders(config.headers);
      const body = serializeBody(config.body, headers);

      await fetchEventSource(config.url, {
        method: config.method ?? "POST",
        headers,
        body,
        signal: abortController.signal,

        onopen: async response => {
          if (response.status === 401) {
            throw new TokenExpiredError();
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get("content-type");

          if (contentType && !contentType.includes("text/event-stream")) {
            throw new Error(`Expected content-type to be text/event-stream, got ${contentType}`);
          }

          retryCount = 0;
          await handlers.onOpen?.(response);
        },

        onmessage: event => {
          handlers.onMessage({
            id: event.id,
            event: event.event,
            data: event.data
          });
        },

        onerror: error => {
          if (abortController.signal.aborted) {
            return;
          }

          if (error instanceof TokenExpiredError) {
            throw error;
          }

          if (this.#options.enableRetry && retryCount < this.#options.maxRetries) {
            retryCount++;
            console.warn(`SSE connection error, retrying (${retryCount}/${this.#options.maxRetries})...`);
            return;
          }

          const err = error as Error;
          handlers.onError?.(err);
          this.#options.showErrorMessage?.(err.message);
          throw error;
        },

        onclose: () => {
          handlers.onClose?.();
        }
      });
    } finally {
      cleanupExternalAbort?.();
      this.#controllers.delete(abortController);
    }
  }

  /**
   * Link external abort signal to internal controller.
   */
  #linkExternalSignal(
    externalSignal: AbortSignal | undefined,
    controller: AbortController
  ): (() => void) | undefined {
    if (!externalSignal) {
      return undefined;
    }

    const handleAbort = () => {
      controller.abort(externalSignal.reason);
    };

    if (externalSignal.aborted) {
      handleAbort();
      return undefined;
    }

    externalSignal.addEventListener("abort", handleAbort, { once: true });
    return () => externalSignal.removeEventListener("abort", handleAbort);
  }

  /**
   * Prepare request headers with auth token injection.
   */
  async #prepareHeaders(configHeaders?: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...configHeaders };

    try {
      const tokens = await this.#options.getAuthTokens?.();

      if (tokens?.accessToken && !hasHeader(headers, "authorization")) {
        headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
    } catch (error) {
      console.error("Failed to get auth tokens:", error);
    }

    return headers;
  }

  /**
   * Attempt to refresh the token. Total by contract: failures resolve
   * `false` so the statechart can report auth failure instead of crashing.
   */
  async #tryTokenRefresh(): Promise<boolean> {
    const { onTokenExpired } = this.#options;

    if (!onTokenExpired) {
      return false;
    }

    try {
      return await onTokenExpired();
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return false;
    }
  }
}
