import { PushClient } from "@vef-framework-react/core";

import { act, renderHook } from "../../test-utils";
import { usePushMessage } from "./index";

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

  addEventListener(type: string, listener: FakeEventListener): void {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }

  close(): void {
    this.closeCalls += 1;
  }

  serverMessage(data: string): void {
    const listeners = this.#listeners.get("message") ?? [];

    for (const listener of listeners) {
      listener({ data });
    }
  }
}

async function connectedClient(): Promise<{ client: PushClient; socket: FakeWebSocket }> {
  const client = new PushClient();

  client.connect();
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  const socket = FakeWebSocket.instances.at(-1);

  if (!socket) {
    throw new Error("no WebSocket was opened");
  }

  return { client, socket };
}

function envelope(type: string): string {
  return JSON.stringify({
    id: "m1",
    type,
    payload: "v",
    time: "2026-07-18T10:00:00Z"
  });
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePushMessage", () => {
  it("delivers matching messages to the handler", async () => {
    const { client, socket } = await connectedClient();
    const handler = vi.fn();

    renderHook(() => usePushMessage(client, "order.changed", handler));

    act(() => socket.serverMessage(envelope("order.changed")));

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: "order.changed", payload: "v" }));
  });

  it("ignores messages of other types", async () => {
    const { client, socket } = await connectedClient();
    const handler = vi.fn();

    renderHook(() => usePushMessage(client, "order.changed", handler));

    act(() => socket.serverMessage(envelope("other.type")));

    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", async () => {
    const { client, socket } = await connectedClient();
    const handler = vi.fn();

    const { unmount } = renderHook(() => usePushMessage(client, "order.changed", handler));
    unmount();

    act(() => socket.serverMessage(envelope("order.changed")));

    expect(handler).not.toHaveBeenCalled();
  });
});
