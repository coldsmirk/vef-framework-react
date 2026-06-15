import type { FetchEventSourceInit } from "@microsoft/fetch-event-source";

import type { SseEventHandlers, SseRequestConfig } from "./types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SseClient } from "./client";

// ──────────────────────────────────────────────────────────────────────────
// Module-level mock infrastructure (vi.mock is hoisted to the top of the file)
// ──────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  return {
    fetchEventSource: vi.fn()
  };
});

vi.mock("@microsoft/fetch-event-source", () => {
  return {
    fetchEventSource: mocks.fetchEventSource
  };
});

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

// Function.prototype is a no-op function — useful as an empty body without
// triggering `@typescript-eslint/no-empty-function`.
const silence = Function.prototype as () => void;

function silenceConsole(method: "warn" | "info" | "error"): void {
  vi.spyOn(console, method).mockImplementation(silence);
}

interface ScriptedOpts extends FetchEventSourceInit {
  onopen?: NonNullable<FetchEventSourceInit["onopen"]>;
  onmessage?: NonNullable<FetchEventSourceInit["onmessage"]>;
  onerror?: NonNullable<FetchEventSourceInit["onerror"]>;
  onclose?: NonNullable<FetchEventSourceInit["onclose"]>;
}

type ScriptFn = (opts: ScriptedOpts, url: string) => Promise<void> | void;

// Script a single fetchEventSource invocation. The scripted function receives
// the options (including handler callbacks) and can invoke them to simulate
// stream lifecycle events. Throw from the script to simulate a failure that
// propagates out of fetchEventSource. Pass `silence` for a no-op script.
function scriptFetchEventSource(script: ScriptFn): void {
  mocks.fetchEventSource.mockImplementationOnce(async (url: string, opts: FetchEventSourceInit) => {
    await script(opts as ScriptedOpts, url);
  });
}

function makeResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    status,
    statusText: status === 200 ? "OK" : "Error",
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null }
  } as unknown as Response;
}

function captureMessageHandlers(): SseEventHandlers & {
  onMessageMock: ReturnType<typeof vi.fn>;
  onOpenMock: ReturnType<typeof vi.fn>;
  onErrorMock: ReturnType<typeof vi.fn>;
  onCloseMock: ReturnType<typeof vi.fn>;
} {
  const onMessageMock = vi.fn();
  const onOpenMock = vi.fn();
  const onErrorMock = vi.fn();
  const onCloseMock = vi.fn();

  return {
    onMessage: onMessageMock,
    onOpen: onOpenMock,
    onError: onErrorMock,
    onClose: onCloseMock,
    onMessageMock,
    onOpenMock,
    onErrorMock,
    onCloseMock
  };
}

function getAccessToken(): { accessToken: string } {
  return { accessToken: "AT" };
}

function refreshOk(): boolean {
  return true;
}

function refreshFail(): boolean {
  return false;
}

async function script401(opts: ScriptedOpts): Promise<void> {
  await opts.onopen?.(makeResponse(401));
}

const DEFAULT_CONFIG: SseRequestConfig = { url: "http://test/stream" };

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe("sse/SseClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("stream request", () => {
    it("invokes fetchEventSource with POST as the default method and forwards the URL", async () => {
      scriptFetchEventSource(silence);
      const client = new SseClient();
      const handlers = captureMessageHandlers();

      await client.stream(DEFAULT_CONFIG, handlers);

      expect(mocks.fetchEventSource).toHaveBeenCalledTimes(1);
      expect(mocks.fetchEventSource).toHaveBeenCalledWith(
        "http://test/stream",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("honors an explicit method override", async () => {
      scriptFetchEventSource(silence);
      const client = new SseClient();
      const handlers = captureMessageHandlers();

      await client.stream({ ...DEFAULT_CONFIG, method: "GET" }, handlers);

      expect(mocks.fetchEventSource).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("serializes object bodies as JSON and sets Content-Type", async () => {
      scriptFetchEventSource(silence);
      const client = new SseClient();
      const handlers = captureMessageHandlers();

      await client.stream({ ...DEFAULT_CONFIG, body: { query: "hello" } }, handlers);

      expect(mocks.fetchEventSource).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ query: "hello" }),
          headers: expect.objectContaining({ "Content-Type": "application/json" })
        })
      );
    });

    it("passes string bodies through unchanged without overriding Content-Type", async () => {
      scriptFetchEventSource(silence);
      const client = new SseClient();
      const handlers = captureMessageHandlers();

      await client.stream(
        {
          ...DEFAULT_CONFIG,
          body: "raw-payload",
          headers: { "Content-Type": "text/plain" }
        },
        handlers
      );

      expect(mocks.fetchEventSource).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: "raw-payload",
          headers: expect.objectContaining({ "Content-Type": "text/plain" })
        })
      );
    });
  });

  describe("auth header injection", () => {
    it("injects a Bearer Authorization header from getAuthTokens", async () => {
      scriptFetchEventSource(silence);
      const client = new SseClient({ getAuthTokens: getAccessToken });
      const handlers = captureMessageHandlers();

      await client.stream(DEFAULT_CONFIG, handlers);

      expect(mocks.fetchEventSource).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer AT" })
        })
      );
    });

    it("does not override an Authorization header that the caller already set", async () => {
      scriptFetchEventSource(silence);
      const client = new SseClient({ getAuthTokens: getAccessToken });
      const handlers = captureMessageHandlers();

      await client.stream(
        { ...DEFAULT_CONFIG, headers: { Authorization: "Bearer CUSTOM" } },
        handlers
      );

      expect(mocks.fetchEventSource).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer CUSTOM" })
        })
      );
    });
  });

  describe("message handling", () => {
    it("forwards id, event, and data fields to the caller's onMessage", async () => {
      scriptFetchEventSource(opts => {
        opts.onmessage?.({
          id: "m-1",
          event: "tick",
          data: "hello",
          retry: 0
        });
      });
      const client = new SseClient();
      const handlers = captureMessageHandlers();

      await client.stream(DEFAULT_CONFIG, handlers);

      expect(handlers.onMessageMock).toHaveBeenCalledWith({
        id: "m-1",
        event: "tick",
        data: "hello"
      });
    });

    it("invokes the caller's onClose when the stream closes", async () => {
      scriptFetchEventSource(opts => {
        opts.onclose?.();
      });
      const client = new SseClient();
      const handlers = captureMessageHandlers();

      await client.stream(DEFAULT_CONFIG, handlers);

      expect(handlers.onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("token refresh on 401", () => {
    it("retries the stream once after a successful token refresh", async () => {
      const onTokenExpired = vi.fn(refreshOk);
      scriptFetchEventSource(script401);
      scriptFetchEventSource(silence);

      const client = new SseClient({ onTokenExpired });
      const handlers = captureMessageHandlers();

      await client.stream(DEFAULT_CONFIG, handlers);

      expect(onTokenExpired).toHaveBeenCalledTimes(1);
      expect(mocks.fetchEventSource).toHaveBeenCalledTimes(2);
    });

    it("delivers an auth-failed error when the refresh callback returns false", async () => {
      const onTokenExpired = vi.fn(refreshFail);
      scriptFetchEventSource(script401);

      const client = new SseClient({ onTokenExpired });
      const handlers = captureMessageHandlers();

      await client.stream(DEFAULT_CONFIG, handlers);

      expect(handlers.onErrorMock).toHaveBeenCalledTimes(1);
      const errorArg = handlers.onErrorMock.mock.calls.at(0)?.[0] as Error;
      expect(errorArg.message).toContain("Authentication failed");
    });

    it("does not call onTokenExpired more than once for the same stream", async () => {
      const onTokenExpired = vi.fn(refreshOk);
      scriptFetchEventSource(script401);
      scriptFetchEventSource(script401);

      const client = new SseClient({ onTokenExpired });
      const handlers = captureMessageHandlers();

      await expect(client.stream(DEFAULT_CONFIG, handlers)).rejects.toBeDefined();
      expect(onTokenExpired).toHaveBeenCalledTimes(1);
    });
  });

  describe("abort", () => {
    it("aborts all in-flight stream controllers", async () => {
      let capturedSignal: AbortSignal | undefined;
      scriptFetchEventSource(opts => {
        capturedSignal = opts.signal ?? undefined;
        // Hold the script open until the signal fires — emulates a live stream.
        return new Promise<void>(resolve => {
          opts.signal?.addEventListener("abort", () => resolve());
        });
      });

      const client = new SseClient();
      const handlers = captureMessageHandlers();
      const pending = client.stream(DEFAULT_CONFIG, handlers);

      await Promise.resolve();
      await Promise.resolve();

      client.abort();
      await pending;

      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  describe("error handling", () => {
    it("calls onError and rejects when an unhandled error escapes the stream", async () => {
      silenceConsole("error");
      const error = new Error("network down");
      scriptFetchEventSource(() => {
        throw error;
      });

      const client = new SseClient();
      const handlers = captureMessageHandlers();

      await expect(client.stream(DEFAULT_CONFIG, handlers)).rejects.toBe(error);
    });
  });
});
