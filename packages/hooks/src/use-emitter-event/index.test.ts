import { createEventEmitter } from "@vef-framework-react/shared";
import { describe, expect, it, vi } from "vitest";

import { renderHook } from "../../test-utils";
import { useEmitterEvent } from "./index";

interface DemoEvents extends Record<string, unknown> {
  greet: { name: string };
  ping: undefined;
}

describe("hooks/useEmitterEvent", () => {
  it("subscribes the listener to the emitter event", () => {
    const emitter = createEventEmitter<DemoEvents>();
    const handler = vi.fn();

    renderHook(() => useEmitterEvent(emitter, "greet", handler));
    emitter.emit("greet", { name: "Alice" });

    expect(handler).toHaveBeenCalledWith({ name: "Alice" });
  });

  it("unsubscribes when the component unmounts", () => {
    const emitter = createEventEmitter<DemoEvents>();
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEmitterEvent(emitter, "greet", handler));

    unmount();
    emitter.emit("greet", { name: "lost" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("re-subscribes to the new event when the eventType changes", () => {
    const emitter = createEventEmitter<DemoEvents>();
    const handler = vi.fn();

    const { rerender } = renderHook(
      ({ event }: { event: keyof DemoEvents }) => useEmitterEvent(emitter, event, handler),
      { initialProps: { event: "greet" } }
    );

    rerender({ event: "ping" });

    emitter.emit("greet", { name: "ignored" });
    expect(handler).not.toHaveBeenCalled();

    emitter.emit("ping");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
