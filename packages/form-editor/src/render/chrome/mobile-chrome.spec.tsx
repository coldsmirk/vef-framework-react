import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mobileContainerChrome } from "./mobile-chrome";

const {
  AddButton,
  RemoveButton,
  Section,
  Subform,
  SubformRow,
  Tabs
} = mobileContainerChrome;

describe("mobileContainerChrome", () => {
  describe("Section", () => {
    it("renders the title and body for the card variant", () => {
      render(
        <Section title="基础信息">
          <span data-testid="body">fields</span>
        </Section>
      );

      expect(screen.getByText("基础信息")).toBeInTheDocument();
      expect(screen.getByTestId("body")).toBeInTheDocument();
    });

    // antd-mobile's Collapse exposes no `aria-expanded`, so open/closed state
    // is asserted through panel-content presence: a never-opened panel's
    // content is NOT mounted (lazy, like antd Tabs) — which is exactly why
    // submit validation is schema-driven rather than mount-driven (see
    // `collectSubmitErrors`); content mounts when the panel is first opened.
    it("renders the title and body for the expanded collapse variant", () => {
      render(
        <Section title="高级设置" variant="collapse">
          <span data-testid="body">fields</span>
        </Section>
      );

      expect(screen.getByText("高级设置")).toBeInTheDocument();
      expect(screen.getByTestId("body")).toBeInTheDocument();
    });

    it("does not mount collapsed-by-default content until the panel is opened", async () => {
      const user = userEvent.setup();

      render(
        <Section defaultCollapsed title="高级设置" variant="collapse">
          <span data-testid="body">fields</span>
        </Section>
      );

      expect(screen.getByText("高级设置")).toBeInTheDocument();
      // Never opened → the panel body is not in the DOM at all. A field in here
      // registers no mounted validator, which the schema-driven submit gate
      // covers.
      expect(screen.queryByTestId("body")).not.toBeInTheDocument();

      await user.click(screen.getByText("高级设置"));

      expect(screen.getByTestId("body")).toBeInTheDocument();
    });
  });

  describe("Tabs", () => {
    it("renders a tab per item", () => {
      render(
        <Tabs
          items={[
            {
              children: <span>A body</span>,
              key: "a",
              label: "标签A"
            },
            {
              children: <span>B body</span>,
              key: "b",
              label: "标签B"
            }
          ]}
        />
      );

      expect(screen.getByRole("tab", { name: "标签A" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "标签B" })).toBeInTheDocument();
    });

    it("marks the active tab as selected", () => {
      render(
        <Tabs
          activeKey="b"
          items={[
            {
              children: <span>A body</span>,
              key: "a",
              label: "标签A"
            },
            {
              children: <span>B body</span>,
              key: "b",
              label: "标签B"
            }
          ]}
        />
      );

      expect(screen.getByRole("tab", { name: "标签B" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "标签A" })).toHaveAttribute("aria-selected", "false");
    });

    it("shows the active tab body", () => {
      render(
        <Tabs
          activeKey="a"
          items={[
            {
              children: <span data-testid="a">A body</span>,
              key: "a",
              label: "标签A"
            },
            {
              children: <span>B body</span>,
              key: "b",
              label: "标签B"
            }
          ]}
        />
      );

      expect(screen.getByTestId("a")).toBeInTheDocument();
    });

    it("fires onChange when another tab is pressed", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <Tabs
          activeKey="a"
          items={[
            {
              children: <span>A body</span>,
              key: "a",
              label: "标签A"
            },
            {
              children: <span>B body</span>,
              key: "b",
              label: "标签B"
            }
          ]}
          onChange={onChange}
        />
      );
      await user.click(screen.getByRole("tab", { name: "标签B" }));

      expect(onChange).toHaveBeenCalledWith("b");
    });
  });

  describe("Subform", () => {
    it("renders the title and body", () => {
      render(
        <Subform title="明细行">
          <span data-testid="rows">rows</span>
        </Subform>
      );

      expect(screen.getByText("明细行")).toBeInTheDocument();
      expect(screen.getByTestId("rows")).toBeInTheDocument();
    });
  });

  describe("SubformRow", () => {
    it("places the remove control alongside the row body", () => {
      render(
        <SubformRow removeControl={<span data-testid="remove">x</span>}>
          <span data-testid="rowbody">row</span>
        </SubformRow>
      );

      expect(screen.getByTestId("rowbody")).toBeInTheDocument();
      expect(screen.getByTestId("remove")).toBeInTheDocument();
    });
  });

  describe("controls", () => {
    it("fires onClick when the add button is pressed", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<AddButton label="新增一行" onClick={onClick} />);
      await user.click(screen.getByRole("button", { name: "新增一行" }));

      expect(onClick).toHaveBeenCalledOnce();
    });

    it("fires onClick when the remove button is pressed", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<RemoveButton onClick={onClick} />);
      await user.click(screen.getByRole("button", { name: "删除此行" }));

      expect(onClick).toHaveBeenCalledOnce();
    });
  });
});
