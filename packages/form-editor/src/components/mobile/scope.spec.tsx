import type { ReactElement } from "react";

import { render, screen, waitFor } from "@testing-library/react";

import { MobileScope, useMobileScopeContainer } from "./scope";
import { admThemeBridge } from "./theme";

describe("MobileScope", () => {
  it("renders its children", () => {
    render(
      <MobileScope>
        <span data-testid="child">field</span>
      </MobileScope>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("exposes the scope node as the overlay container when containing", async () => {
    function Probe(): ReactElement {
      const getContainer = useMobileScopeContainer();

      return <span data-testid="container">{getContainer().dataset.device ?? "body"}</span>;
    }

    render(
      <MobileScope containOverlays>
        <Probe />
      </MobileScope>
    );

    await waitFor(() => expect(screen.getByTestId("container")).toHaveTextContent("mobile"));
  });

  it("falls back to the document body as the overlay container by default", () => {
    function Probe(): ReactElement {
      const getContainer = useMobileScopeContainer();

      return <span data-testid="container">{getContainer().dataset.device ?? "body"}</span>;
    }

    render(
      <MobileScope>
        <Probe />
      </MobileScope>
    );

    expect(screen.getByTestId("container")).toHaveTextContent("body");
  });
});

describe("admThemeBridge", () => {
  it("maps antd-mobile variables onto VEF theme tokens", () => {
    expect(admThemeBridge.styles).toContain("--adm-color-primary: var(--vef-color-primary)");
    expect(admThemeBridge.styles).toContain("--adm-radius-m: var(--vef-border-radius)");
  });
});
