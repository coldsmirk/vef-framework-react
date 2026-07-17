import { Labeled } from ".";
import { render, screen } from "../../test-utils";

describe("Labeled", () => {
  it("renders the label above the control", () => {
    render(
      <Labeled label="系统参数">
        <input aria-label="control" />
      </Labeled>
    );

    expect(screen.getByText("系统参数"), "the label should render").toBeInTheDocument();
    expect(screen.getByLabelText("control"), "the wrapped control should render").toBeInTheDocument();
  });

  it("renders the hint under the control only when given", () => {
    const { rerender } = render(<Labeled hint="非敏感参数" label="参数" />);

    expect(screen.getByText("非敏感参数"), "the hint should render when provided").toBeInTheDocument();

    rerender(<Labeled label="参数" />);

    expect(screen.queryByText("非敏感参数"), "no hint should render when omitted").not.toBeInTheDocument();
  });

  it("marks required labels", () => {
    render(<Labeled required label="委托人" />);

    expect(screen.getByText("*", { exact: false }), "the required marker should render").toBeInTheDocument();
  });
});
