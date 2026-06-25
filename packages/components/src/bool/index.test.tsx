import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../../test-utils";
import { Bool } from "./index";

describe("bool/Bool", () => {
  describe("switch variant (default)", () => {
    it("renders a switch element by default", () => {
      render(<Bool />);

      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("reports boolean toggles to onChange", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<Bool onChange={onChange} />);
      await user.click(screen.getByRole("switch"));

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("reflects the controlled checked prop", () => {
      render(<Bool value />);

      expect(screen.getByRole("switch")).toBeChecked();
    });
  });

  describe("radio variant", () => {
    it("renders two radio inputs labelled with the provided trueLabel and falseLabel", () => {
      render(<Bool falseLabel="拒绝" trueLabel="通过" variant="radio" />);

      expect(screen.getByRole("radio", { name: /通\s*过/ })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /拒\s*绝/ })).toBeInTheDocument();
    });

    it("uses the defaults '是' and '否' when no labels are provided", () => {
      render(<Bool variant="radio" />);

      expect(screen.getByRole("radio", { name: /是/ })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /否/ })).toBeInTheDocument();
    });

    it("reports the selected boolean to onChange when a radio is clicked", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<Bool variant="radio" onChange={onChange} />);
      await user.click(screen.getByRole("radio", { name: /是/ }));

      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe("checkbox variant", () => {
    it("renders a checkbox with the supplied children as the label", () => {
      render(<Bool variant="checkbox">同意条款</Bool>);

      expect(screen.getByRole("checkbox", { name: "同意条款" })).toBeInTheDocument();
    });

    it("reports the checked state to onChange when toggled", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<Bool variant="checkbox" onChange={onChange}>同意条款</Bool>);
      await user.click(screen.getByRole("checkbox"));

      expect(onChange).toHaveBeenCalledWith(true);
    });
  });
});
