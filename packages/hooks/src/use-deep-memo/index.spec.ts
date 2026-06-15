import { useDeepMemo } from ".";
import { renderHook } from "../../test-utils";

describe("useDeepMemo", () => {
  let factoryCallCount: number;
  let mockFactory: ReturnType<typeof vi.fn<() => string>>;

  beforeEach(() => {
    factoryCallCount = 0;
    mockFactory = vi.fn<() => string>(() => {
      factoryCallCount++;
      return `result-${factoryCallCount}`;
    });
  });

  it("calls factory on initial render", () => {
    const { result } = renderHook(() => useDeepMemo(mockFactory, [1, 2, 3]));

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");
  });

  it("does not call factory when dependencies are deeply equal", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [1, 2, 3] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with same primitive values
    rerender({ deps: [1, 2, 3] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");
  });

  it("calls factory when dependencies change", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [1, 2, 3] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different values
    rerender({ deps: [1, 2, 4] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles object dependencies with deep comparison", () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    const obj3 = { a: 1, b: 3 };

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different object but same deep properties
    rerender({ deps: [obj2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with object that has different deep properties
    rerender({ deps: [obj3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles nested objects correctly (deep comparison)", () => {
    const nested1 = { a: { b: 1, c: { d: 2 } } };
    const nested2 = { a: { b: 1, c: { d: 2 } } };
    const nested3 = { a: { b: 1, c: { d: 3 } } };

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [nested1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different object but same deep structure
    rerender({ deps: [nested2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with deeply different object
    rerender({ deps: [nested3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles array dependencies with deep comparison", () => {
    const arr1 = [1, [2, 3], { a: 4 }];
    const arr2 = [1, [2, 3], { a: 4 }];
    const arr3 = [1, [2, 3], { a: 5 }];

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [arr1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different array but same deep elements
    rerender({ deps: [arr2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with array that has different deep elements
    rerender({ deps: [arr3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles complex nested structures", () => {
    const complex1 = {
      users: [
        { id: 1, profile: { name: "Alice", settings: { theme: "dark" } } },
        { id: 2, profile: { name: "Bob", settings: { theme: "light" } } }
      ],
      meta: { count: 2, filters: ["active"] }
    };

    const complex2 = {
      users: [
        { id: 1, profile: { name: "Alice", settings: { theme: "dark" } } },
        { id: 2, profile: { name: "Bob", settings: { theme: "light" } } }
      ],
      meta: { count: 2, filters: ["active"] }
    };

    const complex3 = {
      users: [
        { id: 1, profile: { name: "Alice", settings: { theme: "dark" } } },
        // Changed theme
        { id: 2, profile: { name: "Bob", settings: { theme: "dark" } } }
      ],
      meta: { count: 2, filters: ["active"] }
    };

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [complex1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with deeply equal structure
    rerender({ deps: [complex2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with deeply different structure
    rerender({ deps: [complex3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles mixed types in dependencies", () => {
    const obj = { a: { b: 1 } };
    const arr = [1, [2, 3]];

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [1, "test", obj, arr, true] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with deeply equivalent values
    rerender({ deps: [1, "test", { a: { b: 1 } }, [1, [2, 3]], true] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with one deeply changed value
    rerender({ deps: [1, "test", { a: { b: 2 } }, [1, [2, 3]], true] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles empty dependencies", () => {
    const { result, rerender } = renderHook(
      () => useDeepMemo(mockFactory, [])
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render should not call factory again
    rerender();

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");
  });

  it("handles Date objects", () => {
    const date1 = new Date("2023-01-01");
    const date2 = new Date("2023-01-01");
    const date3 = new Date("2023-01-02");

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [date1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with same date value
    rerender({ deps: [date2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different date
    rerender({ deps: [date3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("returns different values when factory result changes", () => {
    let counter = 0;
    const dynamicFactory = vi.fn(() => {
      return { value: ++counter };
    });

    const { result, rerender } = renderHook(
      ({ trigger }) => useDeepMemo(dynamicFactory, [trigger]),
      {
        initialProps: { trigger: { id: 1 } }
      }
    );

    const firstResult = result.current;
    expect(dynamicFactory).toHaveBeenCalledTimes(1);
    expect(firstResult.value).toBe(1);

    // Re-render with deeply equal dependency - should not call factory
    rerender({ trigger: { id: 1 } });

    expect(dynamicFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(firstResult);

    // Re-render with different dependency - should call factory
    rerender({ trigger: { id: 2 } });

    expect(dynamicFactory).toHaveBeenCalledTimes(2);
    expect(result.current.value).toBe(2);
    expect(result.current).not.toBe(firstResult);
  });

  it("handles circular references in dependencies", () => {
    const obj1: any = { value: 1 };
    obj1.self = obj1;

    const obj2: any = { value: 1 };
    obj2.self = obj2;

    const obj3: any = { value: 2 };
    obj3.self = obj3;

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different object but same circular structure
    rerender({ deps: [obj2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different circular structure
    rerender({ deps: [obj3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles complex circular references", () => {
    const obj1: any = {
      a: 1,
      nested: {
        value: 2
      }
    };
    obj1.nested.parent = obj1;

    const obj2: any = {
      a: 1,
      nested: {
        value: 2
      }
    };
    obj2.nested.parent = obj2;

    const obj3: any = {
      a: 1,
      nested: {
        // Different value
        value: 3
      }
    };
    obj3.nested.parent = obj3;

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with same complex circular structure
    rerender({ deps: [obj2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different complex circular structure
    rerender({ deps: [obj3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles arrays with circular references", () => {
    const arr1: any = [1, 2];
    arr1.push(arr1);

    const arr2: any = [1, 2];
    arr2.push(arr2);

    const arr3: any = [1, 3];
    arr3.push(arr3);

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [arr1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with same circular array structure
    rerender({ deps: [arr2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different circular array structure
    rerender({ deps: [arr3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles deeply nested structures with multiple circular references", () => {
    const root1: any = {
      level1: {
        level2: {
          level3: {}
        }
      }
    };
    root1.level1.level2.level3.backToRoot = root1;
    root1.level1.level2.level3.backToLevel1 = root1.level1;

    const root2: any = {
      level1: {
        level2: {
          level3: {}
        }
      }
    };
    root2.level1.level2.level3.backToRoot = root2;
    root2.level1.level2.level3.backToLevel1 = root2.level1;

    const root3: any = {
      level1: {
        level2: {
          level3: {
            // Additional property
            extraProp: "different"
          }
        }
      }
    };
    root3.level1.level2.level3.backToRoot = root3;
    root3.level1.level2.level3.backToLevel1 = root3.level1;

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [root1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with same deeply nested circular structure
    rerender({ deps: [root2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different deeply nested circular structure
    rerender({ deps: [root3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles mixed circular and non-circular dependencies", () => {
    const circular: any = { value: 1 };
    circular.self = circular;

    const nonCircular = { value: 2 };
    const primitive = "test";

    const { result, rerender } = renderHook(
      ({ deps }) => useDeepMemo(mockFactory, deps),
      {
        initialProps: { deps: [circular, nonCircular, primitive] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with equivalent mixed dependencies
    const newCircular: any = { value: 1 };
    newCircular.self = newCircular;
    rerender({ deps: [newCircular, { value: 2 }, "test"] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different non-circular dependency
    rerender({ deps: [newCircular, { value: 3 }, "test"] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });
});
