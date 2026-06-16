import { describe, expect, it } from "vitest";

import { render, screen } from "../../test-utils";
import { ScrollArea } from "./index";

describe("scroll-area/ScrollArea", () => {
  it("renders the children inside the scroll viewport", () => {
    render(
      <ScrollArea>
        <span data-testid="scroll-content">scrollable content</span>
      </ScrollArea>
    );

    expect(screen.getByTestId("scroll-content")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <ScrollArea>
        <span data-testid="child-1">first</span>
        <span data-testid="child-2">second</span>
      </ScrollArea>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  it("renders both scrollbars by default", () => {
    const { baseElement } = render(
      <ScrollArea type="always">
        <span>scrollable content</span>
      </ScrollArea>
    );

    expect(baseElement.querySelector("[data-orientation='vertical']")).toBeInTheDocument();
    expect(baseElement.querySelector("[data-orientation='horizontal']")).toBeInTheDocument();
  });

  it("can render only the vertical scrollbar", () => {
    const { baseElement } = render(
      <ScrollArea scrollbars="vertical" type="always">
        <span>scrollable content</span>
      </ScrollArea>
    );

    expect(baseElement.querySelector("[data-orientation='vertical']")).toBeInTheDocument();
    expect(baseElement.querySelector("[data-orientation='horizontal']")).not.toBeInTheDocument();
  });
});
