import { useShallowEffect } from ".";
import { renderHook } from "../../test-utils";

describe("useShallowEffect", () => {
  let effectCallCount: number;
  let cleanupCallCount: number;

  const mockCleanup = vi.fn<() => void>(() => {
    cleanupCallCount++;
  });

  const mockEffect = vi.fn<() => void | (() => void)>(() => {
    effectCallCount++;
    return mockCleanup;
  });

  beforeEach(() => {
    effectCallCount = 0;
    cleanupCallCount = 0;
    mockCleanup.mockClear();
    mockEffect.mockClear();
  });

  it("calls effect on initial render", () => {
    renderHook(() => useShallowEffect(mockEffect, [1, 2, 3]));

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(effectCallCount).toBe(1);
    expect(cleanupCallCount).toBe(0);
  });

  it("does not call effect when dependencies are shallowly equal", () => {
    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: [1, 2, 3] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same array content (shallowly equal)
    rerender({ deps: [1, 2, 3] });
    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(effectCallCount).toBe(1);
  });

  it("calls effect when dependencies are shallowly different", () => {
    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: [1, 2, 3] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(cleanupCallCount).toBe(0);

    // Different array content
    rerender({ deps: [1, 2, 4] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
    expect(effectCallCount).toBe(2);
    // Previous effect cleanup should be called
    expect(cleanupCallCount).toBe(1);
  });

  it("handles object dependencies with shallow comparison", () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    const obj3 = { a: 1, b: 3 };

    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different object instance but same shallow content
    rerender({ deps: [obj2] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different shallow content
    rerender({ deps: [obj3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles nested objects correctly (shallow comparison)", () => {
    const nested1 = { value: 1 };
    const nested2 = { value: 1 };
    const obj1 = { nested: nested1 };
    const obj2 = { nested: nested2 };

    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different nested object instance (shallow comparison should detect difference)
    rerender({ deps: [obj2] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles array dependencies with different lengths", () => {
    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: [1, 2, 3] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different length
    rerender({ deps: [1, 2] });
    expect(mockEffect).toHaveBeenCalledTimes(2);

    // Back to original length
    rerender({ deps: [1, 2, 3] });
    expect(mockEffect).toHaveBeenCalledTimes(3);
  });

  it("handles empty dependencies", () => {
    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: [] as number[] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Still empty
    rerender({ deps: [] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Add dependency
    rerender({ deps: [1] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles undefined dependencies", () => {
    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: undefined }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Still undefined (should run every time)
    rerender({ deps: undefined });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("calls cleanup function when effect changes", () => {
    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: [1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(cleanupCallCount).toBe(0);

    // Change dependencies to trigger new effect
    rerender({ deps: [2] });
    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(cleanupCallCount).toBe(1);
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("calls cleanup function on unmount", () => {
    const { unmount } = renderHook(() => useShallowEffect(mockEffect, [1, 2, 3]));

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(cleanupCallCount).toBe(0);

    unmount();
    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(cleanupCallCount).toBe(1);
  });

  it("handles complex objects with multiple properties", () => {
    const obj1 = {
      a: 1,
      b: 2,
      c: "test",
      d: true
    };
    const obj2 = {
      a: 1,
      b: 2,
      c: "test",
      d: true
    };
    const obj3 = {
      a: 1,
      b: 2,
      c: "test",
      d: false
    };

    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same shallow content
    rerender({ deps: [obj2] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different shallow content
    rerender({ deps: [obj3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles mixed primitive and object dependencies", () => {
    const obj = { value: 1 };

    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(mockEffect, deps),
      {
        initialProps: { deps: [1, "test", obj, true] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same content
    rerender({ deps: [1, "test", { value: 1 }, true] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different primitive
    rerender({ deps: [2, "test", { value: 1 }, true] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("works without cleanup function", () => {
    const effectWithoutCleanup = vi.fn();

    const { rerender } = renderHook(
      ({ deps }) => useShallowEffect(effectWithoutCleanup, deps),
      {
        initialProps: { deps: [1] }
      }
    );

    expect(effectWithoutCleanup).toHaveBeenCalledTimes(1);

    rerender({ deps: [2] });
    expect(effectWithoutCleanup).toHaveBeenCalledTimes(2);
  });
});
