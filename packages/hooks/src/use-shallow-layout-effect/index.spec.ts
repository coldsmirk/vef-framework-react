import { describe, expect, it, vi } from "vitest";

import { renderHook } from "../../test-utils";
import { useShallowLayoutEffect } from "./index";

describe("hooks/useShallowLayoutEffect", () => {
  it("runs the effect once on mount", () => {
    const effect = vi.fn();

    renderHook(() => useShallowLayoutEffect(effect, [{ id: 1 }]));

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("does not re-run the effect when dependencies are shallowly equal", () => {
    const effect = vi.fn();
    const { rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useShallowLayoutEffect(effect, deps),
      { initialProps: { deps: [{ id: 1 }] } }
    );

    rerender({ deps: [{ id: 1 }] });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("re-runs the effect when a top-level dependency changes", () => {
    const effect = vi.fn();
    const { rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useShallowLayoutEffect(effect, deps),
      { initialProps: { deps: [{ id: 1 }] } }
    );

    rerender({ deps: [{ id: 2 }] });

    expect(effect).toHaveBeenCalledTimes(2);
  });
});
