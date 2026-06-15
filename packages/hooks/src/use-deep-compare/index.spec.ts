import { describe, expect, it } from "vitest";

import { renderHook } from "../../test-utils";
import { useDeepCompare } from "./index";

function useDeepCompareUndefined(): readonly [number] {
  // Explicit undefined exercises the "trigger on every render" branch.
  // eslint-disable-next-line unicorn/no-useless-undefined
  return useDeepCompare(undefined);
}

describe("hooks/useDeepCompare", () => {
  it("returns the same signal when re-rendered with deeply equal dependencies", () => {
    const { result, rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useDeepCompare(deps),
      { initialProps: { deps: [{ id: 1, nested: { v: 1 } }] } }
    );
    const [initialSignal] = result.current;

    rerender({ deps: [{ id: 1, nested: { v: 1 } }] });

    expect(result.current[0]).toBe(initialSignal);
  });

  it("advances the signal when a nested value differs", () => {
    const { result, rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useDeepCompare(deps),
      { initialProps: { deps: [{ id: 1, nested: { v: 1 } }] } }
    );
    const [initialSignal] = result.current;

    rerender({ deps: [{ id: 1, nested: { v: 2 } }] });

    expect(result.current[0]).not.toBe(initialSignal);
  });

  it("advances the signal whenever called with undefined dependencies", () => {
    const { result, rerender } = renderHook(useDeepCompareUndefined);
    const [initialSignal] = result.current;

    rerender();

    expect(result.current[0]).not.toBe(initialSignal);
  });

  it("advances the signal when array length changes", () => {
    const { result, rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useDeepCompare(deps),
      { initialProps: { deps: [1, 2] } }
    );
    const [initialSignal] = result.current;

    rerender({ deps: [1, 2, 3] });

    expect(result.current[0]).not.toBe(initialSignal);
  });
});
