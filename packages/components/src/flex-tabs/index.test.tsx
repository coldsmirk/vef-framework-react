import { FlexTabs } from ".";
import { render, screen } from "../../test-utils";

describe("FlexTabs", () => {
  it("renders the active pane and stretches inside a flex column", () => {
    const { container } = render(
      <FlexTabs
        items={[
          {
            key: "first",
            label: "第一页",
            children: <div>第一页内容</div>
          },
          {
            key: "second",
            label: "第二页",
            children: <div>第二页内容</div>
          }
        ]}
      />
    );

    expect(screen.getByText("第一页内容"), "the active pane should render").toBeInTheDocument();

    const root = container.querySelector(".vef-tabs");
    expect(root, "the tabs root should render with the framework prefix").not.toBeNull();
    expect(root, "the container should flex-grow into the parent").toHaveStyle({ flexGrow: "1", minHeight: "0px" });
  });
});
