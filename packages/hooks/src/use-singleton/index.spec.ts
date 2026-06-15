import { describe, expect, it, vi } from "vitest";

import { renderHook } from "../../test-utils";
import { useSingleton } from "./index";

describe("hooks/useSingleton", () => {
  it("invokes the initializer only on the first render", () => {
    const initializer = vi.fn(() => {
      return { id: 1 };
    });
    const { rerender } = renderHook(() => useSingleton(initializer));

    expect(initializer).toHaveBeenCalledTimes(1);

    rerender();
    rerender();

    expect(initializer).toHaveBeenCalledTimes(1);
  });

  it("returns a stable ref whose .current is the initializer's return value", () => {
    const value = { name: "stable" };
    const { result, rerender } = renderHook(() => useSingleton(() => value));

    expect(result.current.current).toBe(value);

    const refBeforeRerender = result.current;
    rerender();
    expect(result.current).toBe(refBeforeRerender);
    expect(result.current.current).toBe(value);
  });

  it("supports lazy creation of expensive instances such as EventEmitter analogues", () => {
    class Counter {
      value = 0;
      increment(): void {
        this.value += 1;
      }
    }

    const { result } = renderHook(() => useSingleton(() => new Counter()));

    expect(result.current.current).toBeInstanceOf(Counter);
    result.current.current.increment();
    expect(result.current.current.value).toBe(1);
  });
});
