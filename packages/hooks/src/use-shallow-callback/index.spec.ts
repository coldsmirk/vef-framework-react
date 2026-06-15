/* eslint-disable react-hooks/exhaustive-deps */
import { describe, expect, it } from "vitest";

import { renderHook } from "../../test-utils";
import { useShallowCallback } from "./index";

describe("hooks/useShallowCallback", () => {
  it("returns the cached callback when dependencies are shallowly equal", () => {
    const { result, rerender } = renderHook(
      ({ value, deps }: { value: number; deps: unknown[] }) => useShallowCallback(() => value, deps),
      { initialProps: { value: 1, deps: [{ id: 1 }] } }
    );
    const initialCallback = result.current;

    rerender({ value: 2, deps: [{ id: 1 }] });

    expect(result.current).toBe(initialCallback);
    expect(result.current()).toBe(1);
  });

  it("returns a new callback that closes over the latest props when dependencies change", () => {
    const { result, rerender } = renderHook(
      ({ value, deps }: { value: number; deps: unknown[] }) => useShallowCallback(() => value, deps),
      { initialProps: { value: 1, deps: [{ id: 1 }] } }
    );
    const initialCallback = result.current;

    rerender({ value: 2, deps: [{ id: 2 }] });

    expect(result.current).not.toBe(initialCallback);
    expect(result.current()).toBe(2);
  });
});
