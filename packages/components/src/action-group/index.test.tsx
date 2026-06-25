import type { ReactNode } from "react";

import type { ActionButtonConfig } from "../_base";

import userEvent from "@testing-library/user-event";

import { ActionGroup } from ".";
import { render, screen } from "../../test-utils";

interface TestContext {
  userId: string;
  role: string;
}

describe("ActionGroup", () => {
  const basicButtons: ActionButtonConfig[] = [
    {
      key: "edit",
      label: "Edit",
      onClick: vi.fn()
    },
    {
      key: "delete",
      label: "Delete",
      onClick: vi.fn()
    }
  ];

  it("renders buttons correctly", () => {
    render(<ActionGroup buttons={basicButtons} />);

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("handles button clicks", async () => {
    const user = userEvent.setup();
    const editClick = vi.fn();
    const deleteClick = vi.fn();

    const buttons: ActionButtonConfig[] = [
      {
        key: "edit",
        label: "Edit",
        onClick: editClick
      },
      {
        key: "delete",
        label: "Delete",
        onClick: deleteClick
      }
    ];

    render(<ActionGroup buttons={buttons} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(editClick).toHaveBeenCalledTimes(1);
    expect(deleteClick).toHaveBeenCalledTimes(1);
  });

  it("filters buttons based on hidden property", () => {
    const buttons: ActionButtonConfig[] = [
      {
        key: "edit",
        label: "Edit",
        hidden: false,
        onClick: vi.fn()
      },
      {
        key: "delete",
        label: "Delete",
        hidden: true,
        onClick: vi.fn()
      },
      {
        key: "view",
        label: "View",
        // hidden undefined defaults to false
        onClick: vi.fn()
      }
    ];

    render(<ActionGroup buttons={buttons} />);

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });

  it("handles disabled buttons", () => {
    const buttons: ActionButtonConfig[] = [
      {
        key: "edit",
        label: "Edit",
        disabled: false,
        onClick: vi.fn()
      },
      {
        key: "delete",
        label: "Delete",
        disabled: true,
        onClick: vi.fn()
      }
    ];

    render(<ActionGroup buttons={buttons} />);

    expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("renders buttons with different sizes", () => {
    render(<ActionGroup buttons={basicButtons} size="large" />);

    const editButton = screen.getByRole("button", { name: "Edit" });
    expect(editButton).toHaveClass("vef-btn-lg");
  });

  it("supports confirmable buttons", async () => {
    const user = userEvent.setup();
    const buttons: ActionButtonConfig[] = [
      {
        key: "delete",
        label: "Delete",
        confirmable: true,
        confirmTitle: "确认删除",
        confirmDescription: "此操作不可撤销",
        onClick: vi.fn()
      }
    ];

    render(<ActionGroup buttons={buttons} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("确认删除")).toBeInTheDocument();
    expect(screen.getByText("此操作不可撤销")).toBeInTheDocument();
  });

  it("supports context-based dynamic properties", () => {
    const context: TestContext = {
      userId: "123",
      role: "admin"
    };

    const buttons: Array<ActionButtonConfig<TestContext>> = [
      {
        key: "edit",
        label: "Edit",
        hidden: ctx => ctx.role !== "admin",
        disabled: ctx => ctx.userId === "123",
        onClick: vi.fn()
      },
      {
        key: "delete",
        label: "Delete",
        hidden: ctx => ctx.role !== "user",
        onClick: vi.fn()
      }
    ];

    render(<ActionGroup buttons={buttons} context={context} />);

    // Edit button should show (admin role) but be disabled (userId === "123")
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();

    // Delete button should not show (role !== "user")
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("supports custom renderWrapper", () => {
    const customWrapper = (buttons: ReactNode) => (
      <div className="custom-action-bar" data-testid="custom-wrapper">
        {buttons}
      </div>
    );

    render(
      <ActionGroup
        buttons={basicButtons}
        renderWrapper={customWrapper}
      />
    );

    const wrapper = screen.getByTestId("custom-wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("custom-action-bar");
    expect(wrapper).toContainElement(screen.getByRole("button", { name: "Edit" }));
  });

  it("renders null when no buttons are visible", () => {
    const buttons: ActionButtonConfig[] = [
      {
        key: "hidden",
        label: "Hidden",
        hidden: true,
        onClick: vi.fn()
      }
    ];

    render(<ActionGroup buttons={buttons} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("handles buttons with icons", () => {
    const buttons: ActionButtonConfig[] = [
      {
        key: "edit",
        label: "Edit",
        icon: <span data-testid="edit-icon">✏️</span>,
        onClick: vi.fn()
      }
    ];

    render(<ActionGroup buttons={buttons} />);

    expect(screen.getByTestId("edit-icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
  });

  it("supports permission-based filtering", () => {
    const buttons: ActionButtonConfig[] = [
      {
        key: "edit",
        label: "Edit",
        requiredPermissions: ["user:edit"],
        onClick: vi.fn()
      },
      {
        key: "delete",
        label: "Delete",
        requiredPermissions: ["user:delete"],
        onClick: vi.fn()
      }
    ];

    // Test with permission check that allows edit but not delete
    render(
      <ActionGroup buttons={buttons} />,
      {
        appContext: {
          hasPermission: (permission: string) => permission === "user:edit"
        }
      }
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("handles different button colors and variants", () => {
    const buttons: ActionButtonConfig[] = [
      {
        key: "primary",
        label: "Primary",
        color: "primary",
        variant: "filled",
        onClick: vi.fn()
      },
      {
        key: "danger",
        label: "Danger",
        color: "danger",
        variant: "outlined",
        onClick: vi.fn()
      }
    ];

    render(<ActionGroup buttons={buttons} />);

    const primaryButton = screen.getByRole("button", { name: "Primary" });
    const dangerButton = screen.getByRole("button", { name: "Danger" });

    expect(primaryButton).toHaveClass("vef-btn-color-primary");
    expect(dangerButton).toHaveClass("vef-btn-color-dangerous");
  });

  it("handles empty buttons array", () => {
    render(<ActionGroup buttons={[]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
