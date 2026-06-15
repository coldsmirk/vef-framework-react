import { describe, expect, it, vi } from "vitest";

import { renderHook } from "../../test-utils";
import { useDeepLayoutEffect } from "./index";

describe("hooks/useDeepLayoutEffect", () => {
  it("runs the effect once on mount", () => {
    const effect = vi.fn();

    renderHook(() => useDeepLayoutEffect(effect, [{ v: 1 }]));

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("does not re-run the effect when dependencies are deeply equal", () => {
    const effect = vi.fn();
    const { rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useDeepLayoutEffect(effect, deps),
      { initialProps: { deps: [{ v: 1 }] } }
    );

    rerender({ deps: [{ v: 1 }] });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("re-runs the effect when a deep dependency changes", () => {
    const effect = vi.fn();
    const { rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useDeepLayoutEffect(effect, deps),
      { initialProps: { deps: [{ v: 1 }] } }
    );

    rerender({ deps: [{ v: 2 }] });

    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("invokes the cleanup function when the effect re-runs", () => {
    const cleanup = vi.fn();

    function effect(): () => void {
      return cleanup;
    }

    const { rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) => useDeepLayoutEffect(effect, deps),
      { initialProps: { deps: [{ v: 1 }] } }
    );

    rerender({ deps: [{ v: 2 }] });

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
