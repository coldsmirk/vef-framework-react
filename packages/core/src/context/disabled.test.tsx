import type { JSX, PropsWithChildren } from "react";

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DisabledProvider, useDisabled } from "./disabled";

describe("context/useDisabled", () => {
  it("returns false when no DisabledProvider wraps the consumer", () => {
    const { result } = renderHook(() => useDisabled());

    expect(result.current).toBe(false);
  });

  it("returns true when wrapped in DisabledProvider value={true}", () => {
    function wrapper({ children }: PropsWithChildren): JSX.Element {
      return <DisabledProvider value>{children}</DisabledProvider>;
    }

    const { result } = renderHook(() => useDisabled(), { wrapper });

    expect(result.current).toBe(true);
  });

  it("returns the inner provider's value when the inner provider overrides true to false", () => {
    function wrapper({ children }: PropsWithChildren): JSX.Element {
      return (
        <DisabledProvider value>
          <DisabledProvider value={false}>
            {children}
          </DisabledProvider>
        </DisabledProvider>
      );
    }

    const { result } = renderHook(() => useDisabled(), { wrapper });

    expect(result.current).toBe(false);
  });

  it("returns the inner provider's value when the inner provider overrides false to true", () => {
    function wrapper({ children }: PropsWithChildren): JSX.Element {
      return (
        <DisabledProvider value={false}>
          <DisabledProvider value>
            {children}
          </DisabledProvider>
        </DisabledProvider>
      );
    }

    const { result } = renderHook(() => useDisabled(), { wrapper });

    expect(result.current).toBe(true);
  });
});
