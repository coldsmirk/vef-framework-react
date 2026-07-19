import type { PushMessage, PushStatus } from "./types";

import { PushClient } from "./client";
import { PUSH_CLOSE_SESSION_INVALID, PUSH_CLOSE_TOO_MANY_CONNECTIONS } from "./types";

// ──────────────────────────────────────────────────────────────────────────
// Fake WebSocket driver
// ──────────────────────────────────────────────────────────────────────────

type FakeEventListener = (event: unknown) => void;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly #listeners = new Map<string, FakeEventListener[]>();

  readonly url: string;
  closeCalls = 0;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  #emit(type: string, event: unknown): void {
    const listeners = this.#listeners.get(type) ?? [];

    for (const listener of listeners) {
      listener(event);
    }
  }

  addEventListener(type: string, listener: FakeEventListener): void {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }

  close(): void {
    this.closeCalls += 1;
  }

  serverOpen(): void {
    this.#emit("open", new Event("open"));
  }

  serverMessage(data: unknown): void {
    this.#emit("message", { data });
  }

  serverClose(code: number, reason = ""): void {
    this.#emit("close", { code, reason });
  }
}

function lastSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1);

  if (!socket) {
    throw new Error("no WebSocket was opened");
  }

  return socket;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function envelope(overrides: Partial<PushMessage> = {}): string {
  return JSON.stringify({
    id: "m1",
    type: "order.changed",
    payload: { orderId: "o-1" },
    time: "2026-07-18T10:00:00Z",
    ...overrides
  });
}

const silence = Function.prototype as () => void;

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("PushClient", () => {
  describe("connecting", () => {
    it("appends the access token to the endpoint query string", async () => {
      const client = new PushClient({
        getAuthTokens: () => { return { accessToken: "tok-1" }; },
        url: "/ws"
      });

      client.connect();
      await flush();

      const url = new URL(lastSocket().url);
      expect(url.protocol).toBe("ws:");
      expect(url.pathname).toBe("/ws");
      expect(url.searchParams.get("__accessToken")).toBe("tok-1");
    });

    it("converts an https endpoint to wss", async () => {
      const client = new PushClient({ url: "https://api.example.com/ws" });

      client.connect();
      await flush();

      expect(lastSocket().url).toBe("wss://api.example.com/ws");
    });

    it("keeps one session across repeated connect calls", async () => {
      const client = new PushClient();

      client.connect();
      await flush();
      lastSocket().serverOpen();
      client.connect();
      await flush();

      expect(FakeWebSocket.instances).toHaveLength(1);
    });
  });

  describe("message dispatch", () => {
    it("delivers messages to type subscribers and the wildcard", async () => {
      const client = new PushClient();
      const onOrder = vi.fn();
      const onAll = vi.fn();
      const onOther = vi.fn();
      client.subscribe("order.changed", onOrder);
      client.subscribe("*", onAll);
      client.subscribe("other.type", onOther);

      client.connect();
      await flush();
      lastSocket().serverOpen();
      lastSocket().serverMessage(envelope());

      expect(onOrder).toHaveBeenCalledWith(expect.objectContaining({ id: "m1", payload: { orderId: "o-1" } }));
      expect(onAll).toHaveBeenCalledTimes(1);
      expect(onOther).not.toHaveBeenCalled();
    });

    it("stops delivering after unsubscribe", async () => {
      const client = new PushClient();
      const handler = vi.fn();
      const unsubscribe = client.subscribe("order.changed", handler);

      client.connect();
      await flush();
      lastSocket().serverOpen();

      unsubscribe();
      lastSocket().serverMessage(envelope());

      expect(handler).not.toHaveBeenCalled();
    });

    it("drops malformed frames without breaking the session", async () => {
      vi.spyOn(console, "warn").mockImplementation(silence);

      const client = new PushClient();
      const handler = vi.fn();
      client.subscribe("*", handler);

      client.connect();
      await flush();
      lastSocket().serverOpen();

      lastSocket().serverMessage("not json");
      lastSocket().serverMessage(JSON.stringify({ id: "x" }));
      lastSocket().serverMessage(envelope());

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("reconnecting", () => {
    it("reopens with a fresh token after a transport loss", async () => {
      vi.useFakeTimers();

      const getAuthTokens = vi.fn(() => {
        return { accessToken: "tok" };
      });
      const client = new PushClient({ getAuthTokens, reconnect: { initialDelay: 1000 } });

      client.connect();
      await flush();
      lastSocket().serverOpen();
      lastSocket().serverClose(1006);

      expect(client.status).toBe("reconnecting");

      await vi.advanceTimersByTimeAsync(1300);

      expect(FakeWebSocket.instances).toHaveLength(2);
      expect(getAuthTokens).toHaveBeenCalledTimes(2);
    });

    it("does not reconnect when reconnect is disabled", async () => {
      vi.useFakeTimers();

      const client = new PushClient({ reconnect: { enabled: false } });

      client.connect();
      await flush();
      lastSocket().serverClose(1006);

      await vi.advanceTimersByTimeAsync(60_000);

      expect(client.status).toBe("closed");
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("reports status transitions across the session", async () => {
      vi.useFakeTimers();

      const statuses: PushStatus[] = [];
      const client = new PushClient({
        onStatusChange: status => {
          statuses.push(status);
        }
      });

      client.connect();
      await flush();
      lastSocket().serverOpen();
      lastSocket().serverClose(1001);
      await vi.advanceTimersByTimeAsync(1300);
      lastSocket().serverOpen();

      expect(statuses).toEqual(["connecting", "open", "reconnecting", "open"]);
    });
  });

  describe("terminal closes", () => {
    it("treats a session-invalid close as terminal", async () => {
      vi.useFakeTimers();

      const onSessionInvalid = vi.fn();
      const client = new PushClient({ onSessionInvalid });

      client.connect();
      await flush();
      lastSocket().serverOpen();
      lastSocket().serverClose(PUSH_CLOSE_SESSION_INVALID, "session revoked");

      await vi.advanceTimersByTimeAsync(60_000);

      expect(client.status).toBe("closed");
      expect(onSessionInvalid).toHaveBeenCalledWith(expect.objectContaining({ code: PUSH_CLOSE_SESSION_INVALID }));
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("treats a connection-cap close as terminal", async () => {
      vi.useFakeTimers();

      const onConnectionRejected = vi.fn();
      const client = new PushClient({ onConnectionRejected });

      client.connect();
      await flush();
      lastSocket().serverClose(PUSH_CLOSE_TOO_MANY_CONNECTIONS, "connection limit reached");

      await vi.advanceTimersByTimeAsync(60_000);

      expect(client.status).toBe("closed");
      expect(onConnectionRejected).toHaveBeenCalledTimes(1);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
  });

  describe("closing", () => {
    it("close() ends the session and suppresses reconnection", async () => {
      vi.useFakeTimers();

      const client = new PushClient();

      client.connect();
      await flush();
      const socket = lastSocket();
      socket.serverOpen();

      client.close();

      expect(socket.closeCalls).toBe(1);
      expect(client.status).toBe("closed");

      socket.serverClose(1006);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(client.status).toBe("closed");
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("can connect again after an explicit close", async () => {
      const client = new PushClient();

      client.connect();
      await flush();
      client.close();
      client.connect();
      await flush();

      expect(FakeWebSocket.instances).toHaveLength(2);
    });
  });
});
