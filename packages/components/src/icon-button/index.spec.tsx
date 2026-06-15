import userEvent from "@testing-library/user-event";
import { PlusIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../../test-utils";
import { Icon } from "../icon";
import { IconButton } from "./index";

describe("icon-button/IconButton", () => {
  it("renders a button with the provided icon", () => {
    render(<IconButton icon={<Icon component={PlusIcon} />} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("forwards onClick to the underlying button", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<IconButton icon={<Icon component={PlusIcon} />} onClick={onClick} />);
    await user.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not wrap with a Tooltip when tip is omitted", () => {
    render(<IconButton icon={<Icon component={PlusIcon} />} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("wraps the button with a Tooltip when tip is provided", async () => {
    const user = userEvent.setup();
    render(<IconButton icon={<Icon component={PlusIcon} />} tip="Add item" tipDelay={0} />);

    await user.hover(screen.getByRole("button"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Add item");
  });
});
