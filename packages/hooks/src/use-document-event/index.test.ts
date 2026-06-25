import { describe, expect, it, vi } from "vitest";

import { renderHook } from "../../test-utils";
import { useDocumentEvent } from "./index";

describe("hooks/useDocumentEvent", () => {
  it("delivers document events to the listener while mounted", () => {
    const listener = vi.fn();

    renderHook(() => useDocumentEvent("click", listener));
    document.dispatchEvent(new Event("click"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount", () => {
    const listener = vi.fn();
    const { unmount } = renderHook(() => useDocumentEvent("click", listener));

    unmount();
    document.dispatchEvent(new Event("click"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("invokes the latest listener after a rerender with a new function", () => {
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const { rerender } = renderHook(
      ({ handler }: { handler: () => void }) => useDocumentEvent("click", handler),
      { initialProps: { handler: firstListener } }
    );

    rerender({ handler: secondListener });
    document.dispatchEvent(new Event("click"));

    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledTimes(1);
  });

  it("subscribes again when the event type changes", () => {
    const listener = vi.fn();

    const { rerender } = renderHook(
      ({ type }: { type: "click" | "keydown" }) => useDocumentEvent(type, listener),
      { initialProps: { type: "click" } }
    );

    rerender({ type: "keydown" });

    document.dispatchEvent(new Event("click"));
    expect(listener).not.toHaveBeenCalled();

    document.dispatchEvent(new Event("keydown"));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
