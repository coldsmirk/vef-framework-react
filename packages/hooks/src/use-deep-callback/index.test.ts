/* eslint-disable react-hooks/exhaustive-deps -- deep-equality hook compares dep values, not references */
import { describe, expect, it } from "vitest";

import { renderHook } from "../../test-utils";
import { useDeepCallback } from "./index";

describe("hooks/useDeepCallback", () => {
  it("returns the cached callback when re-rendered with deeply equal dependencies", () => {
    const { result, rerender } = renderHook(
      ({ value, deps }: { value: number; deps: unknown[] }) => useDeepCallback(() => value, deps),
      { initialProps: { value: 1, deps: [{ v: 1 }] } }
    );
    const initialCallback = result.current;

    rerender({ value: 2, deps: [{ v: 1 }] });

    expect(result.current).toBe(initialCallback);
    // The cached callback closes over the original render's value.
    expect(result.current()).toBe(1);
  });

  it("returns a new callback that closes over the latest props when dependencies change", () => {
    const { result, rerender } = renderHook(
      ({ value, deps }: { value: number; deps: unknown[] }) => useDeepCallback(() => value, deps),
      { initialProps: { value: 1, deps: [{ v: 1 }] } }
    );
    const initialCallback = result.current;

    rerender({ value: 2, deps: [{ v: 2 }] });

    expect(result.current).not.toBe(initialCallback);
    expect(result.current()).toBe(2);
  });
});
