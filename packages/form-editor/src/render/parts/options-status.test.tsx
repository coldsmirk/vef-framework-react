import { render, screen } from "@testing-library/react";

import { OptionsStatus } from "./options-status";

describe("OptionsStatus", () => {
  it("shows a loading hint while options resolve", () => {
    render(<OptionsStatus loading error={false} />);

    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  it("shows an error alert when the data source failed", () => {
    render(<OptionsStatus error loading={false} />);

    expect(screen.getByRole("alert")).toHaveTextContent("选项加载失败");
  });

  it("shows an empty hint when there are no options and no failure", () => {
    render(<OptionsStatus error={false} loading={false} />);

    expect(screen.getByText("暂无选项")).toBeInTheDocument();
  });

  it("prefers the loading hint over the error state", () => {
    render(<OptionsStatus error loading />);

    expect(screen.getByText("加载中…")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
