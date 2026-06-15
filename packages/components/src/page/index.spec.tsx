import { describe, expect, it } from "vitest";

import { render, screen } from "../../test-utils";
import { Page } from "./index";

describe("page/Page", () => {
  describe("main content", () => {
    it("renders children inside the main content area", () => {
      render(
        <Page>
          <span data-testid="page-body">page content</span>
        </Page>
      );

      expect(screen.getByTestId("page-body")).toBeInTheDocument();
    });
  });

  describe("aside slots", () => {
    it("renders the leftAside content when provided", () => {
      render(
        <Page leftAside={<aside data-testid="left-aside">Left</aside>}>
          <span>body</span>
        </Page>
      );

      expect(screen.getByTestId("left-aside")).toBeInTheDocument();
    });

    it("renders the rightAside content when provided", () => {
      render(
        <Page rightAside={<aside data-testid="right-aside">Right</aside>}>
          <span>body</span>
        </Page>
      );

      expect(screen.getByTestId("right-aside")).toBeInTheDocument();
    });

    it("does not render an aside container when no aside content is provided", () => {
      render(
        <Page>
          <span>body</span>
        </Page>
      );

      expect(screen.queryByTestId("left-aside")).not.toBeInTheDocument();
      expect(screen.queryByTestId("right-aside")).not.toBeInTheDocument();
    });
  });

  describe("header and footer", () => {
    it("renders the header slot when header is provided", () => {
      render(
        <Page header={<div data-testid="page-header">Header</div>}>
          <span>body</span>
        </Page>
      );

      expect(screen.getByTestId("page-header")).toBeInTheDocument();
    });

    it("renders the footer slot when footer is provided", () => {
      render(
        <Page footer={<div data-testid="page-footer">Footer</div>}>
          <span>body</span>
        </Page>
      );

      expect(screen.getByTestId("page-footer")).toBeInTheDocument();
    });

    it("renders both header and footer when both are provided", () => {
      render(
        <Page
          footer={<div data-testid="page-footer">Footer</div>}
          header={<div data-testid="page-header">Header</div>}
        >
          <span>body</span>
        </Page>
      );

      expect(screen.getByTestId("page-header")).toBeInTheDocument();
      expect(screen.getByTestId("page-footer")).toBeInTheDocument();
    });
  });
});
