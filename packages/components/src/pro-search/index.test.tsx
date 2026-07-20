import userEvent from "@testing-library/user-event";

import { ProSearch } from ".";
import { render, screen } from "../../test-utils";

describe("ProSearch", () => {
  it("lets the search controls shrink beside toolbar content", () => {
    render(
      <ProSearch
        basicSearch={<input aria-label="名称" />}
        extra={<button type="button">新增</button>}
      />
    );

    const controls = screen.getByRole("button", { name: "搜索" }).parentElement;

    expect(controls).toHaveStyle({
      flexGrow: "1",
      flexShrink: "1",
      minWidth: "0px"
    });
  });

  it("toggles the advanced search panel", async () => {
    const user = userEvent.setup();

    render(
      <ProSearch
        advancedSearch={<div>详细条件</div>}
        basicSearch={<input aria-label="名称" />}
      />
    );

    expect(screen.queryByText("详细条件")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "高级搜索" }));

    expect(screen.getByText("详细条件")).toBeInTheDocument();
  });
});
