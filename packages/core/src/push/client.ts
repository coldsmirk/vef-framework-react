import type { PushClientOptions, PushMessage, PushMessageHandler, PushStatus } from "./types";

import { PUSH_CLOSE_SESSION_INVALID, PUSH_CLOSE_TOO_MANY_CONNECTIONS } from "./types";

/**
 * Access-token query parameter of the vef push endpoint (the Go side's
 * `security.QueryKeyAccessToken`).
 */
const ACCESS_TOKEN_QUERY_KEY = "__accessToken";

/**
 * Ratio of random jitter added to each backoff delay so a fleet of clients
 * does not reconnect in lockstep after a server restart.
 */
const BACKOFF_JITTER_RATIO = 0.3;

/**
 * Resolve the configured endpoint into an absolute WebSocket URL.
 */
function toWebSocketUrl(url: string): URL {
  const resolved = new URL(url, location.href);

  if (resolved.protocol === "http:") {
    resolved.protocol = "ws:";
  } else if (resolved.protocol === "https:") {
    resolved.protocol = "wss:";
  }

  return resolved;
}

/**
 * Client for the vef server push channel (`vef.push`, WebSocket, downstream
 * only). Delivery is best-effort by the server contract — this channel is the
 * real-time hint, while reliable state lives behind the regular API.
 *
 * Handlers subscribe by envelope `type` (`"*"` receives everything).
 * Transport-level losses reconnect with jittered exponential backoff and a
 * freshly read access token; the terminal close codes 4401 (session invalid)
 * and 4429 (connection cap) surface through their callbacks and never
 * reconnect. `close()` is the app-driven exit (e.g. logout).
 */
export class PushClient {
  readonly #options: PushClientOptions;
  readonly #handlers = new Map<string, Set<PushMessageHandler>>();

  #socket: WebSocket | null = null;
  #status: PushStatus = "idle";
  #attempts = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #closedByUser = false;

  constructor(options: PushClientOptions = {}) {
    this.#options = options;
  }

  async #open(phase: "connecting" | "reconnecting"): Promise<void> {
    this.#setStatus(phase);

    const url = toWebSocketUrl(this.#options.url ?? "/ws");
    const tokens = await this.#options.getAuthTokens?.();

    if (this.#closedByUser) {
      return;
    }

    if (tokens?.accessToken) {
      url.searchParams.set(ACCESS_TOKEN_QUERY_KEY, tokens.accessToken);
    }

    const socket = new WebSocket(url.href);
    this.#socket = socket;

    socket.addEventListener("open", () => {
      this.#attempts = 0;
      this.#setStatus("open");
    });

    socket.addEventListener("message", event => {
      this.#dispatch(event.data);
    });

    socket.addEventListener("close", event => {
      if (this.#socket !== socket) {
        return;
      }

      this.#socket = null;
      this.#handleClose(event);
    });
  }

  #handleClose(event: CloseEvent): void {
    if (this.#closedByUser) {
      this.#setStatus("closed");
      return;
    }

    if (event.code === PUSH_CLOSE_SESSION_INVALID) {
      this.#setStatus("closed");
      this.#options.onSessionInvalid?.(event);
      return;
    }

    if (event.code === PUSH_CLOSE_TOO_MANY_CONNECTIONS) {
      this.#setStatus("closed");
      this.#options.onConnectionRejected?.(event);
      return;
    }

    if (this.#options.reconnect?.enabled === false) {
      this.#setStatus("closed");
      return;
    }

    this.#scheduleReconnect();
  }

  #scheduleReconnect(): void {
    this.#setStatus("reconnecting");

    const initialDelay = this.#options.reconnect?.initialDelay ?? 1000;
    const maxDelay = this.#options.reconnect?.maxDelay ?? 30_000;
    const base = Math.min(maxDelay, initialDelay * 2 ** this.#attempts);
    const delay = base + base * BACKOFF_JITTER_RATIO * Math.random();

    this.#attempts += 1;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      void this.#open("reconnecting");
    }, delay);
  }

  #clearReconnectTimer(): void {
    if (this.#reconnectTimer === null) {
      return;
    }

    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
  }

  #dispatch(data: unknown): void {
    if (typeof data !== "string") {
      return;
    }

    let message: PushMessage;

    try {
      message = JSON.parse(data) as PushMessage;
    } catch {
      console.warn("[vef-push] Dropping malformed push frame");
      return;
    }

    if (typeof message?.type !== "string" || message.type === "") {
      console.warn("[vef-push] Dropping push frame without a type");
      return;
    }

    for (const handler of this.#handlersFor(message.type)) {
      handler(message);
    }
  }

  #handlersFor(type: string): PushMessageHandler[] {
    return [...this.#handlers.get(type) ?? [], ...this.#handlers.get("*") ?? []];
  }

  #setStatus(status: PushStatus): void {
    if (this.#status === status) {
      return;
    }

    this.#status = status;
    this.#options.onStatusChange?.(status);
  }

  /**
   * Current connection status.
   */
  get status(): PushStatus {
    return this.#status;
  }

  /**
   * Open the connection. Safe to call repeatedly; an active session is kept.
   */
  connect(): void {
    if (this.#status !== "idle" && this.#status !== "closed") {
      return;
    }

    this.#closedByUser = false;
    this.#attempts = 0;
    void this.#open("connecting");
  }

  /**
   * Close the connection and stop reconnecting (the logout path).
   */
  close(): void {
    this.#closedByUser = true;
    this.#clearReconnectTimer();

    const socket = this.#socket;
    this.#socket = null;

    if (socket) {
      socket.close();
    }

    this.#setStatus("closed");
  }

  /**
   * Subscribe a handler to messages of one envelope type (`"*"` receives
   * every message). Returns the unsubscribe function.
   */
  subscribe<TPayload = unknown>(type: string, handler: PushMessageHandler<TPayload>): () => void {
    let handlers = this.#handlers.get(type);

    if (!handlers) {
      handlers = new Set();
      this.#handlers.set(type, handlers);
    }

    handlers.add(handler as PushMessageHandler);

    return () => {
      handlers.delete(handler as PushMessageHandler);

      if (handlers.size === 0) {
        this.#handlers.delete(type);
      }
    };
  }
}
