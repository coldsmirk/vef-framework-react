import { useDeepEffect } from ".";
import { renderHook } from "../../test-utils";

describe("useDeepEffect", () => {
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
    renderHook(() => useDeepEffect(mockEffect, [1, 2, 3]));

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(effectCallCount).toBe(1);
    expect(cleanupCallCount).toBe(0);
  });

  it("does not call effect when dependencies are deeply equal", () => {
    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [1, 2, 3] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same array content (deeply equal)
    rerender({ deps: [1, 2, 3] });
    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(effectCallCount).toBe(1);
  });

  it("calls effect when dependencies are deeply different", () => {
    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
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

  it("handles object dependencies with deep comparison", () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    const obj3 = { a: 1, b: 3 };

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different object instance but same deep content
    rerender({ deps: [obj2] });
    // Should not call again due to deep equality
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different deep content
    rerender({ deps: [obj3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles nested objects correctly (deep comparison)", () => {
    const nested1 = { value: 1 };
    const nested2 = { value: 1 };
    const nested3 = { value: 2 };
    const obj1 = { nested: nested1 };
    const obj2 = { nested: nested2 };
    const obj3 = { nested: nested3 };

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different nested object instance but same deep content
    rerender({ deps: [obj2] });
    // Should not call again due to deep equality
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different deep content in nested object
    rerender({ deps: [obj3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles deeply nested objects", () => {
    const obj1 = {
      level1: {
        level2: {
          level3: {
            value: "test"
          }
        }
      }
    };

    const obj2 = {
      level1: {
        level2: {
          level3: {
            value: "test"
          }
        }
      }
    };

    const obj3 = {
      level1: {
        level2: {
          level3: {
            value: "different"
          }
        }
      }
    };

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same deep structure with different object instances
    rerender({ deps: [obj2] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different deep content
    rerender({ deps: [obj3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles arrays with objects", () => {
    const arr1 = [{ id: 1, name: "test" }, { id: 2, name: "test2" }];
    const arr2 = [{ id: 1, name: "test" }, { id: 2, name: "test2" }];
    const arr3 = [{ id: 1, name: "test" }, { id: 2, name: "different" }];

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [arr1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same deep content in array
    rerender({ deps: [arr2] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different deep content in array
    rerender({ deps: [arr3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles array dependencies with different lengths", () => {
    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
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
      ({ deps }) => useDeepEffect(mockEffect, deps),
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
      ({ deps }) => useDeepEffect(mockEffect, deps),
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
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [{ value: 1 }] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(cleanupCallCount).toBe(0);

    // Change dependencies to trigger new effect
    rerender({ deps: [{ value: 2 }] });
    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(cleanupCallCount).toBe(1);
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("calls cleanup function on unmount", () => {
    const { unmount } = renderHook(() => useDeepEffect(mockEffect, [{ deep: { value: 1 } }]));

    expect(mockEffect).toHaveBeenCalledTimes(1);
    expect(cleanupCallCount).toBe(0);

    unmount();
    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(cleanupCallCount).toBe(1);
  });

  it("handles complex nested structures", () => {
    const complex1 = {
      users: [
        { id: 1, profile: { name: "John", settings: { theme: "dark" } } },
        { id: 2, profile: { name: "Jane", settings: { theme: "light" } } }
      ],
      metadata: {
        total: 2,
        filters: { active: true, role: "admin" }
      }
    };

    const complex2 = {
      users: [
        { id: 1, profile: { name: "John", settings: { theme: "dark" } } },
        { id: 2, profile: { name: "Jane", settings: { theme: "light" } } }
      ],
      metadata: {
        total: 2,
        filters: { active: true, role: "admin" }
      }
    };

    const complex3 = {
      users: [
        { id: 1, profile: { name: "John", settings: { theme: "dark" } } },
        // Changed theme
        { id: 2, profile: { name: "Jane", settings: { theme: "dark" } } }
      ],
      metadata: {
        total: 2,
        filters: { active: true, role: "admin" }
      }
    };

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [complex1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same deep structure
    rerender({ deps: [complex2] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different deep structure
    rerender({ deps: [complex3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles Date objects", () => {
    const date1 = new Date("2023-01-01");
    const date2 = new Date("2023-01-01");
    const date3 = new Date("2023-01-02");

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [date1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same date value, different instance
    rerender({ deps: [date2] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different date value
    rerender({ deps: [date3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles circular references safely", () => {
    const obj1: any = { value: 1 };
    obj1.self = obj1;

    const obj2: any = { value: 1 };
    obj2.self = obj2;

    const obj3: any = { value: 2 };
    obj3.self = obj3;

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same structure with circular reference
    rerender({ deps: [obj2] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different structure with circular reference
    rerender({ deps: [obj3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("handles complex objects without circular references", () => {
    const obj1 = {
      value: 1,
      nested: {
        array: [1, 2, { deep: "test" }],
        config: { enabled: true }
      }
    };

    const obj2 = {
      value: 1,
      nested: {
        array: [1, 2, { deep: "test" }],
        config: { enabled: true }
      }
    };

    const obj3 = {
      value: 1,
      nested: {
        array: [1, 2, { deep: "different" }],
        config: { enabled: true }
      }
    };

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same deep structure
    rerender({ deps: [obj2] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different deep structure
    rerender({ deps: [obj3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });

  it("works without cleanup function", () => {
    const effectWithoutCleanup = vi.fn();

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(effectWithoutCleanup, deps),
      {
        initialProps: { deps: [{ value: 1 }] }
      }
    );

    expect(effectWithoutCleanup).toHaveBeenCalledTimes(1);

    rerender({ deps: [{ value: 2 }] });
    expect(effectWithoutCleanup).toHaveBeenCalledTimes(2);
  });

  it("handles RegExp objects", () => {
    const regex1 = /test/g;
    const regex2 = /test/g;
    const regex3 = /different/g;

    const { rerender } = renderHook(
      ({ deps }) => useDeepEffect(mockEffect, deps),
      {
        initialProps: { deps: [regex1] }
      }
    );

    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Same regex pattern, different instance
    rerender({ deps: [regex2] });
    expect(mockEffect).toHaveBeenCalledTimes(1);

    // Different regex pattern
    rerender({ deps: [regex3] });
    expect(mockEffect).toHaveBeenCalledTimes(2);
  });
});
