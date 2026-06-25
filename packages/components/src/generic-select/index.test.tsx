import type { GenericSelectPopupApi } from "./props";

import userEvent from "@testing-library/user-event";

import { GenericSelect } from ".";
import { render, screen } from "../../test-utils";

/**
 * A minimal popup body that commits one of two fixed values. Keeping the body
 * trivial lets these specs assert the base's contract (open state, value
 * commit, label rendering) without depending on any concrete implementation.
 */
function pickerPopup({ select, close }: GenericSelectPopupApi<string>) {
  return (
    <button
      type="button"
      onClick={() => {
        select("alpha");
        close();
      }}
    >
      pick alpha
    </button>
  );
}

describe("GenericSelect", () => {
  describe("rendering", () => {
    it("renders the placeholder when no value is selected", () => {
      render(<GenericSelect placeholder="选择内容" renderPopup={pickerPopup} />);

      expect(screen.getByText("选择内容")).toBeInTheDocument();
    });

    it("renders the selected value through renderLabel", () => {
      render(
        <GenericSelect<string>
          renderLabel={value => `图标-${value}`}
          renderPopup={pickerPopup}
          value="home"
        />
      );

      expect(screen.getByText("图标-home")).toBeInTheDocument();
    });
  });

  describe("open state", () => {
    it("opens the popup body when the trigger is clicked", async () => {
      const user = userEvent.setup();
      render(<GenericSelect placeholder="选择" renderPopup={pickerPopup} />);

      await user.click(screen.getByRole("combobox"));

      expect(await screen.findByRole("button", { name: "pick alpha" })).toBeInTheDocument();
    });

    it("renders the popup immediately when controlled open", async () => {
      render(<GenericSelect open placeholder="选择" renderPopup={pickerPopup} />);

      expect(await screen.findByRole("button", { name: "pick alpha" })).toBeInTheDocument();
    });

    it("keeps the popup closed when disabled", async () => {
      const user = userEvent.setup();
      render(<GenericSelect disabled placeholder="选择" renderPopup={pickerPopup} />);

      await user.click(screen.getByRole("combobox"));

      expect(screen.getByRole("combobox")).toBeDisabled();
      expect(screen.queryByRole("button", { name: "pick alpha" })).not.toBeInTheDocument();
    });
  });

  describe("selection", () => {
    it("commits the chosen value through onChange", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<GenericSelect placeholder="选择" renderPopup={pickerPopup} onChange={onChange} />);

      await user.click(screen.getByRole("combobox"));
      await user.click(await screen.findByRole("button", { name: "pick alpha" }));

      expect(onChange).toHaveBeenCalledWith("alpha");
    });

    it("requests close through onOpenChange after a confirming selection", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <GenericSelect open placeholder="选择" renderPopup={pickerPopup} onOpenChange={onOpenChange} />
      );

      await user.click(await screen.findByRole("button", { name: "pick alpha" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
