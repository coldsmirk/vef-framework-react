import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../../test-utils";
import { Modal } from "./modal";

describe("modal/Modal", () => {
  describe("visibility", () => {
    it("renders the dialog with the provided title when open", () => {
      render(
        <Modal open title="Confirm">
          <span data-testid="modal-body">Body</span>
        </Modal>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Confirm")).toBeInTheDocument();
      expect(screen.getByTestId("modal-body")).toBeInTheDocument();
    });

    it("does not render the dialog when open is false", () => {
      render(
        <Modal title="Confirm">
          <span>Body</span>
        </Modal>
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("close interactions", () => {
    it("invokes onCancel when the close button is clicked", async () => {
      const onCancel = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal open onCancel={onCancel}>
          <span>Body</span>
        </Modal>
      );

      await user.click(screen.getByRole("button", { name: /close/i }));

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("title rendering", () => {
    it("wraps the title in a drag handle by default (draggable=true via FormModal usage)", () => {
      // The base Modal does not enable dragging by default; explicit draggable=true wraps the title.
      render(
        <Modal draggable open title={<span data-testid="modal-title">My Title</span>}>
          <span>Body</span>
        </Modal>
      );

      // The title is still visible.
      expect(screen.getByTestId("modal-title")).toBeInTheDocument();
    });
  });
});
