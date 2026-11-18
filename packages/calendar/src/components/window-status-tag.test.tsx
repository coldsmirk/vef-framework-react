import { render, screen } from "../../test-utils";
import { WindowStatusTag } from "./window-status-tag";

const interval = {
  startsAtUnixMs: new Date(2025, 10, 3, 10).getTime(),
  endsAtUnixMs: new Date(2025, 10, 3, 12).getTime()
};

describe("WindowStatusTag", () => {
  it("shows the closing time of an open window", () => {
    render(<WindowStatusTag status={{ open: true, current: interval }} />);
    expect(screen.getByText("开放中 · 12:00 截止")).toBeInTheDocument();
  });

  it("names a long-running window without inventing a cutoff", () => {
    render(<WindowStatusTag status={{ open: true, current: {} }} />);
    expect(screen.getByText("长期开放")).toBeInTheDocument();
  });

  it("shows the next opening with its weekday", () => {
    render(<WindowStatusTag status={{ open: false, next: interval }} />);
    const next = screen.getByText("下次开放：11 月 3 日（周一）10:00");
    expect(next).toBeInTheDocument();
    expect(next).toHaveStyle({
      width: "fit-content",
      maxWidth: "100%",
      whiteSpace: "normal"
    });
  });

  it("explains when no opening is in sight", () => {
    render(<WindowStatusTag status={{ open: false }} />);
    expect(screen.getByText("近期不开放")).toBeInTheDocument();
  });
});
