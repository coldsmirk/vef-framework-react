import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act, renderHook } from "../../test-utils";
import { useViewportSize } from "./index";

describe("hooks/useViewportSize", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the initial width and height from window.innerWidth/innerHeight", () => {
    const { result } = renderHook(() => useViewportSize());

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(result.current).toEqual({
      width: window.innerWidth,
      height: window.innerHeight
    });
  });

  it("updates the size when the window resizes", () => {
    const { result } = renderHook(() => useViewportSize());

    act(() => {
      vi.advanceTimersByTime(16);
    });

    act(() => {
      Object.defineProperties(globalThis, {
        innerWidth: { configurable: true, value: 1366 },
        innerHeight: { configurable: true, value: 768 }
      });
      dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(16);
    });

    expect(result.current).toEqual({ width: 1366, height: 768 });
  });

  it("updates the size when the device orientation changes", () => {
    const { result } = renderHook(() => useViewportSize());

    act(() => {
      vi.advanceTimersByTime(16);
    });

    act(() => {
      Object.defineProperties(globalThis, {
        innerWidth: { configurable: true, value: 800 },
        innerHeight: { configurable: true, value: 1200 }
      });
      dispatchEvent(new Event("orientationchange"));
      vi.advanceTimersByTime(16);
    });

    expect(result.current).toEqual({ width: 800, height: 1200 });
  });
});
