import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../../test-utils";
import { OperationButton } from "./index";

describe("operation-button/OperationButton", () => {
  it("renders an ActionButton when no required permissions are provided", () => {
    render(<OperationButton>Edit</OperationButton>);

    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
  });

  it("forwards onClick to the underlying button", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<OperationButton onClick={onClick}>Save</OperationButton>);
    await user.click(screen.getByRole("button", { name: /Save/ }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the button when the user holds the required permission", () => {
    render(
      <OperationButton requiredPermissions={["orders:edit"]}>Edit</OperationButton>,
      { appContext: { hasPermission: token => token === "orders:edit" } }
    );

    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
  });

  it("hides the button when the user lacks the required permission", () => {
    render(
      <OperationButton requiredPermissions={["orders:edit"]}>Edit</OperationButton>,
      { appContext: { hasPermission: () => false } }
    );

    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
  });

  it("requires all listed tokens when checkMode is 'all'", () => {
    render(
      <OperationButton checkMode="all" requiredPermissions={["a", "b"]}>Edit</OperationButton>,
      { appContext: { hasPermission: token => token === "a" } }
    );

    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
  });
});
