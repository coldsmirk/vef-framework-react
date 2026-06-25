import { useShallowMemo } from ".";
import { renderHook } from "../../test-utils";

describe("useShallowMemo", () => {
  let factoryCallCount: number;

  const mockFactory = vi.fn<() => string>(() => {
    factoryCallCount++;
    return `result-${factoryCallCount}`;
  });

  beforeEach(() => {
    factoryCallCount = 0;
    mockFactory.mockClear();
  });

  it("calls factory on initial render", () => {
    const { result } = renderHook(() => useShallowMemo(mockFactory, [1, 2, 3]));

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");
  });

  it("does not call factory when dependencies are shallowly equal", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useShallowMemo(mockFactory, deps),
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
      ({ deps }) => useShallowMemo(mockFactory, deps),
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

  it("handles object dependencies with shallow comparison", () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    const obj3 = { a: 1, b: 3 };

    const { result, rerender } = renderHook(
      ({ deps }) => useShallowMemo(mockFactory, deps),
      {
        initialProps: { deps: [obj1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different object but same shallow properties
    rerender({ deps: [obj2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with object that has different shallow properties
    rerender({ deps: [obj3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles nested objects correctly (shallow comparison)", () => {
    const sharedNested = { b: 1 };
    const nested1 = { a: sharedNested };
    // Different nested reference
    const nested2 = { a: { b: 1 } };

    const depsArray1 = [nested1];
    const depsArray2 = [nested2];
    // Same object content but new array
    const depsArray3 = [nested1];

    const { result, rerender } = renderHook(
      ({ deps }) => useShallowMemo(mockFactory, deps),
      {
        initialProps: { deps: depsArray1 }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different object - shallow comparison fails at object level
    rerender({ deps: depsArray2 });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");

    // Re-render with same object content in new array - still triggers re-run because array reference changed
    rerender({ deps: depsArray3 });

    expect(mockFactory).toHaveBeenCalledTimes(3);
    expect(result.current).toBe("result-3");
  });

  it("handles array dependencies", () => {
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    const arr3 = [1, 2, 4];

    const { result, rerender } = renderHook(
      ({ deps }) => useShallowMemo(mockFactory, deps),
      {
        initialProps: { deps: [arr1] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with different array but same elements
    rerender({ deps: [arr2] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with array that has different elements
    rerender({ deps: [arr3] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles mixed types in dependencies", () => {
    const obj = { a: 1 };
    const arr = [1, 2];

    const { result, rerender } = renderHook(
      ({ deps }) => useShallowMemo(mockFactory, deps),
      {
        initialProps: { deps: [1, "test", obj, arr, true] }
      }
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with equivalent values
    rerender({ deps: [1, "test", { a: 1 }, [1, 2], true] });

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render with one changed value
    rerender({ deps: [1, "test", { a: 2 }, [1, 2], true] });

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("result-2");
  });

  it("handles empty dependencies", () => {
    const { result, rerender } = renderHook(
      () => useShallowMemo(mockFactory, [])
    );

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");

    // Re-render should not call factory again
    rerender();

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("result-1");
  });

  it("returns different values when factory result changes", () => {
    let counter = 0;
    const dynamicFactory = vi.fn(() => {
      return { value: ++counter };
    });

    const { result, rerender } = renderHook(
      ({ trigger }) => useShallowMemo(dynamicFactory, [trigger]),
      {
        initialProps: { trigger: 1 }
      }
    );

    const firstResult = result.current;
    expect(dynamicFactory).toHaveBeenCalledTimes(1);
    expect(firstResult.value).toBe(1);

    // Re-render with same dependency - should not call factory
    rerender({ trigger: 1 });

    expect(dynamicFactory).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(firstResult);

    // Re-render with different dependency - should call factory
    rerender({ trigger: 2 });

    expect(dynamicFactory).toHaveBeenCalledTimes(2);
    expect(result.current.value).toBe(2);
    expect(result.current).not.toBe(firstResult);
  });
});
