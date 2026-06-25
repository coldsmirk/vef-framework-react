import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act, renderHook } from "../../test-utils";
import { useRafState } from "./index";

describe("hooks/useRafState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial state synchronously", () => {
    const { result } = renderHook(() => useRafState(0));

    expect(result.current[0]).toBe(0);
  });

  it("supports a lazy initializer function", () => {
    const initializer = vi.fn(() => 42);
    const { result } = renderHook(() => useRafState(initializer));

    expect(result.current[0]).toBe(42);
    expect(initializer).toHaveBeenCalledTimes(1);
  });

  it("updates state asynchronously on the next animation frame", () => {
    const { result } = renderHook(() => useRafState(0));

    act(() => {
      result.current[1](1);
    });
    // Update is queued — value has not changed yet.
    expect(result.current[0]).toBe(0);

    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current[0]).toBe(1);
  });

  it("coalesces rapid updates into the most recent value", () => {
    const { result } = renderHook(() => useRafState(0));

    act(() => {
      result.current[1](1);
      result.current[1](2);
      result.current[1](3);
    });
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(result.current[0]).toBe(3);
  });

  it("accepts a functional setter", () => {
    const { result } = renderHook(() => useRafState(10));

    act(() => {
      result.current[1](prev => prev + 5);
    });
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(result.current[0]).toBe(15);
  });

  it("cancels the pending frame on unmount", () => {
    const cancelAnimationFrameSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    const { result, unmount } = renderHook(() => useRafState(0));

    act(() => {
      result.current[1](1);
    });

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });
});
