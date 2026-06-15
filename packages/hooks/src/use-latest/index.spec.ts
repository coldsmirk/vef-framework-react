import { describe, expect, it } from "vitest";

import { renderHook } from "../../test-utils";
import { useLatest } from "./index";

describe("hooks/useLatest", () => {
  it("returns a ref initialized to the provided value", () => {
    const { result } = renderHook(() => useLatest("initial"));

    expect(result.current.current).toBe("initial");
  });

  it("updates ref.current on every render", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useLatest(value),
      { initialProps: { value: "first" } }
    );

    expect(result.current.current).toBe("first");

    rerender({ value: "second" });
    expect(result.current.current).toBe("second");

    rerender({ value: "third" });
    expect(result.current.current).toBe("third");
  });

  it("returns a stable ref object across renders", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useLatest(value),
      { initialProps: { value: 1 } }
    );
    const initialRef = result.current;

    rerender({ value: 2 });

    expect(result.current).toBe(initialRef);
  });
});
