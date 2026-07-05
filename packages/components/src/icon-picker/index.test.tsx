import userEvent from "@testing-library/user-event";

import { IconPicker } from ".";
import { render, screen } from "../../test-utils";

// jsdom reports `offsetWidth`/`offsetHeight` of 0 for every element, which
// starves the grid virtualizer (it sizes its viewport from those) and renders
// zero rows. Give it a real box so the visible icon cells mount — the
// virtualization geometry itself is exercised live, not here.
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { configurable: true, get: () => 320 },
    offsetHeight: { configurable: true, get: () => 264 }
  });
});

afterAll(() => {
  if (originalOffsetWidth) {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
  }

  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  }
});

describe("IconPicker", () => {
  describe("rendering", () => {
    it("renders the placeholder when no icon is selected", () => {
      render(<IconPicker placeholder="请选择图标" />);

      expect(screen.getByText("请选择图标")).toBeInTheDocument();
    });

    it("previews the selected icon name in the trigger", () => {
      render(<IconPicker value="house" />);

      expect(screen.getByText("house")).toBeInTheDocument();
    });
  });

  describe("popup", () => {
    it("opens a grid of icons when the trigger is clicked", async () => {
      const user = userEvent.setup();
      render(<IconPicker placeholder="请选择图标" />);

      await user.click(screen.getByRole("combobox"));

      // "a-arrow-down" is the first name in the lucide set.
      expect(await screen.findByRole("button", { name: "a-arrow-down" })).toBeInTheDocument();
    });

    it("filters the grid by the search keyword", async () => {
      const user = userEvent.setup();
      render(<IconPicker placeholder="请选择图标" />);

      await user.click(screen.getByRole("combobox"));
      await user.type(screen.getByRole("combobox"), "heart");

      expect(await screen.findByRole("button", { name: "heart-handshake" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "a-arrow-down" })).not.toBeInTheDocument();
    });
  });

  describe("selection", () => {
    it("commits the chosen icon through onChange", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<IconPicker placeholder="请选择图标" onChange={onChange} />);

      await user.click(screen.getByRole("combobox"));
      await user.type(screen.getByRole("combobox"), "heart");
      await user.click(await screen.findByRole("button", { name: "heart-handshake" }));

      expect(onChange).toHaveBeenCalledWith("heart-handshake");
    });

    it("previews the picked icon in the trigger when uncontrolled", async () => {
      const user = userEvent.setup();
      render(<IconPicker placeholder="请选择图标" />);

      await user.click(screen.getByRole("combobox"));
      await user.type(screen.getByRole("combobox"), "heart");
      await user.click(await screen.findByRole("button", { name: "heart-handshake" }));

      // The cells carry the name only as an accessible label, so this text node
      // can only be the trigger's preview of the picked value.
      expect(await screen.findByText("heart-handshake")).toBeInTheDocument();
    });
  });

  describe("controlled value", () => {
    it("reflects an external value change and clears when it is unset", () => {
      const { rerender } = render(<IconPicker value="house" />);

      expect(screen.getByText("house")).toBeInTheDocument();

      // An external reset (e.g. the form's resetField) sets the value to undefined.
      rerender(<IconPicker placeholder="请选择图标" value={undefined} />);

      expect(screen.queryByText("house")).not.toBeInTheDocument();
      expect(screen.getByText("请选择图标")).toBeInTheDocument();
    });
  });

  describe("clear", () => {
    it("clears the value through onChange when the clear control is clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<IconPicker value="house" onChange={onChange} />);

      const clear = screen.getByRole("combobox").closest(".vef-select")?.querySelector(".vef-select-clear");

      if (!(clear instanceof HTMLElement)) {
        throw new TypeError("clear control not found");
      }

      await user.click(clear);

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe("disabled", () => {
    it("disables the trigger", () => {
      render(<IconPicker disabled placeholder="请选择图标" />);

      expect(screen.getByRole("combobox")).toBeDisabled();
    });
  });
});
