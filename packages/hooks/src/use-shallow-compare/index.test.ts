import { describe, expect, it } from "vitest";

import { renderHook } from "../../test-utils";
import { useShallowCompare } from "./index";

function useShallowCompareUndefined(): readonly [number] {
  // eslint-disable-next-line unicorn/no-useless-undefined -- explicit undefined exercises the "trigger on every render" branch
  return useShallowCompare(undefined);
}

describe("hooks/useShallowCompare", () => {
  it("returns the same signal when dependencies are shallowly equal", () => {
    const { result, rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useShallowCompare(deps),
      { initialProps: { deps: [{ id: 1 }, "name"] } }
    );
    const [initialSignal] = result.current;

    rerender({ deps: [{ id: 1 }, "name"] });

    expect(result.current[0]).toBe(initialSignal);
  });

  it("advances the signal when a top-level value differs", () => {
    const { result, rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useShallowCompare(deps),
      { initialProps: { deps: [{ id: 1 }] } }
    );
    const [initialSignal] = result.current;

    rerender({ deps: [{ id: 2 }] });

    expect(result.current[0]).not.toBe(initialSignal);
  });

  it("advances the signal when array length changes", () => {
    const { result, rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useShallowCompare(deps),
      { initialProps: { deps: [1, 2] } }
    );
    const [initialSignal] = result.current;

    rerender({ deps: [1, 2, 3] });

    expect(result.current[0]).not.toBe(initialSignal);
  });

  it("advances the signal whenever called with undefined dependencies", () => {
    const { result, rerender } = renderHook(useShallowCompareUndefined);
    const [initialSignal] = result.current;

    rerender();

    expect(result.current[0]).not.toBe(initialSignal);
  });
});
