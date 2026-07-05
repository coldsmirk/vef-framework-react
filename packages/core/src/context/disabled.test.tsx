import type { JSX, PropsWithChildren } from "react";

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DisabledProvider, useDisabled } from "./disabled";

function trueDisabledWrapper({ children }: PropsWithChildren): JSX.Element {
  return <DisabledProvider value>{children}</DisabledProvider>;
}

function trueThenFalseDisabledWrapper({ children }: PropsWithChildren): JSX.Element {
  return (
    <DisabledProvider value>
      <DisabledProvider value={false}>
        {children}
      </DisabledProvider>
    </DisabledProvider>
  );
}

function falseThenTrueDisabledWrapper({ children }: PropsWithChildren): JSX.Element {
  return (
    <DisabledProvider value={false}>
      <DisabledProvider value>
        {children}
      </DisabledProvider>
    </DisabledProvider>
  );
}

describe("context/useDisabled", () => {
  it("returns false when no DisabledProvider wraps the consumer", () => {
    const { result } = renderHook(() => useDisabled());

    expect(result.current).toBe(false);
  });

  it("returns true when wrapped in DisabledProvider value={true}", () => {
    const { result } = renderHook(() => useDisabled(), { wrapper: trueDisabledWrapper });

    expect(result.current).toBe(true);
  });

  it("returns the inner provider's value when the inner provider overrides true to false", () => {
    const { result } = renderHook(() => useDisabled(), { wrapper: trueThenFalseDisabledWrapper });

    expect(result.current).toBe(false);
  });

  it("returns the inner provider's value when the inner provider overrides false to true", () => {
    const { result } = renderHook(() => useDisabled(), { wrapper: falseThenTrueDisabledWrapper });

    expect(result.current).toBe(true);
  });
});
