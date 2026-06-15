import { describe, expect, it } from "vitest";

import { render, screen } from "../../test-utils";
import { Keyboard } from "./index";

describe("keyboard/Keyboard", () => {
  it("renders a <kbd> element with the provided children", () => {
    render(<Keyboard>Ctrl</Keyboard>);

    const kbd = screen.getByText("Ctrl");
    expect(kbd.tagName).toBe("KBD");
  });

  it("forwards arbitrary HTML attributes such as title", () => {
    render(<Keyboard title="Control key">Ctrl</Keyboard>);

    expect(screen.getByText("Ctrl")).toHaveAttribute("title", "Control key");
  });

  it("renders multiple keys side by side when composed in a fragment", () => {
    render(
      <>
        <Keyboard>Ctrl</Keyboard>
        <span>+</span>
        <Keyboard>K</Keyboard>
      </>
    );

    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
  });
});
