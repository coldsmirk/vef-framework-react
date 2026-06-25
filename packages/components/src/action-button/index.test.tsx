import type { ActionButtonProps } from "./props";

import userEvent from "@testing-library/user-event";

import { ActionButton } from ".";
import { render, screen, waitFor } from "../../test-utils";

describe("ActionButton", () => {
  it("renders basic button correctly", () => {
    render(<ActionButton>Click me</ActionButton>);

    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <ActionButton onClick={handleClick}>
        Click me
      </ActionButton>
    );

    await user.click(screen.getByRole("button", { name: "Click me" }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("shows popconfirm when confirmable is true", async () => {
    const user = userEvent.setup();
    render(
      <ActionButton
        confirmable
        confirmDescription="确定要执行此操作吗？"
        confirmTitle="确认操作"
      >
        Delete
      </ActionButton>
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("确认操作")).toBeInTheDocument();
    expect(screen.getByText("确定要执行此操作吗？")).toBeInTheDocument();
  });

  it("executes onClick after confirm", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <ActionButton
        confirmable
        confirmTitle="确认操作"
        onClick={handleClick}
      >
        Delete
      </ActionButton>
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(handleClick).not.toHaveBeenCalled();

    await user.click(screen.getByText("确定"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not execute onClick when confirm is cancelled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <ActionButton
        confirmable
        confirmTitle="确认操作"
        onClick={handleClick}
      >
        Delete
      </ActionButton>
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(handleClick).not.toHaveBeenCalled();

    await user.click(screen.getByText("取消"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("handles different button props", () => {
    const props: ActionButtonProps = {
      danger: true,
      disabled: true,
      size: "large",
      type: "primary"
    };

    render(<ActionButton {...props}>Primary Button</ActionButton>);

    const button = screen.getByRole("button", { name: "Primary Button" });
    expect(button).toHaveClass("vef-btn-primary");
    expect(button).toHaveClass("vef-btn-lg");
    expect(button).toHaveClass("vef-btn-dangerous");
    expect(button).toBeDisabled();
  });

  it("uses default confirm texts", async () => {
    const user = userEvent.setup();
    render(
      <ActionButton confirmable>
        Delete
      </ActionButton>
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("确认提示")).toBeInTheDocument();
    expect(screen.getByText("确定要执行此操作吗？")).toBeInTheDocument();
  });

  it("supports custom confirm mode", async () => {
    const user = userEvent.setup();
    render(
      <ActionButton
        confirmable
        confirmMode="popover"
        confirmTitle="Custom Title"
      >
        Action
      </ActionButton>
    );

    await user.click(screen.getByRole("button", { name: "Action" }));

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
  });

  it("handles onClick execution and loading states", async () => {
    const user = userEvent.setup();
    const { promise: clickPromise, resolve: resolveClick } = Promise.withResolvers<void>();
    const handleClick = vi.fn().mockImplementation(() => clickPromise);

    render(
      <ActionButton onClick={handleClick}>
        Async Button
      </ActionButton>
    );

    const button = screen.getByRole("button", { name: "Async Button" });
    await user.click(button);

    expect(button).toHaveClass("vef-btn-loading");
    expect(handleClick).toHaveBeenCalledTimes(1);

    resolveClick();

    await waitFor(() => {
      expect(button).not.toHaveClass("vef-btn-loading");
    });
  });
});
