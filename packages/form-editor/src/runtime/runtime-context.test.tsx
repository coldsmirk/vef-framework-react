import type { ReactElement } from "react";

import type { RuntimeFieldState } from "../engine/linkage";

import { render, screen } from "@testing-library/react";

import { RuntimeStateContextProvider, useRuntimeFieldState } from "./runtime-context";

function fieldState(over: Partial<RuntimeFieldState> = {}): RuntimeFieldState {
  return {
    hidden: false,
    disabled: false,
    required: false,
    assigned: false,
    ...over
  };
}

function Probe({ id }: { id: string }): ReactElement {
  const state = useRuntimeFieldState(id);

  return <span data-testid={id}>{state.hidden ? "hidden" : "visible"}</span>;
}

describe("runtime-context", () => {
  describe("useRuntimeFieldState", () => {
    it("falls back to the empty state for an unknown field", () => {
      render(
        <RuntimeStateContextProvider value={{}}>
          <Probe id="x" />
        </RuntimeStateContextProvider>
      );

      expect(screen.getByTestId("x")).toHaveTextContent("visible");
    });

    it("reads the field's state from the provider", () => {
      render(
        <RuntimeStateContextProvider value={{ x: fieldState({ hidden: true }) }}>
          <Probe id="x" />
        </RuntimeStateContextProvider>
      );

      expect(screen.getByTestId("x")).toHaveTextContent("hidden");
    });

    it("resolves the nearest provider when nested, so a row scope shadows the root", () => {
      render(
        <RuntimeStateContextProvider value={{ amount: fieldState({ hidden: false }) }}>
          <RuntimeStateContextProvider value={{ amount: fieldState({ hidden: true }) }}>
            <Probe id="amount" />
          </RuntimeStateContextProvider>
        </RuntimeStateContextProvider>
      );

      // The inner (row) provider wins for a descendant — the per-row subform
      // scope isolation the runtime relies on.
      expect(screen.getByTestId("amount")).toHaveTextContent("hidden");
    });
  });
});
