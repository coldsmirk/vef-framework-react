import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { pcContainerChrome } from "./pc-chrome";

const {
  AddButton,
  RemoveButton,
  Section,
  Subform,
  SubformRow,
  Tabs
} = pcContainerChrome;

describe("pcContainerChrome", () => {
  describe("Section", () => {
    it("renders a card with the title and body", () => {
      render(
        <Section title="基础信息">
          <span data-testid="body">fields</span>
        </Section>
      );

      expect(screen.getByText("基础信息")).toBeInTheDocument();
      expect(screen.getByTestId("body")).toBeInTheDocument();
    });

    it("renders an expanded collapse panel for the collapse variant", () => {
      render(
        <Section title="高级设置" variant="collapse">
          <span data-testid="body">fields</span>
        </Section>
      );

      expect(screen.getByRole("button", { name: /高级设置/ })).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("body")).toBeInTheDocument();
    });

    it("starts collapsed when defaultCollapsed is set", () => {
      render(
        <Section defaultCollapsed title="高级设置" variant="collapse">
          <span>fields</span>
        </Section>
      );

      expect(screen.getByRole("button", { name: /高级设置/ })).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("Tabs", () => {
    it("renders a tab per item and shows the active tab body", () => {
      render(
        <Tabs
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

      expect(screen.getByRole("tab", { name: "标签A" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "标签B" })).toBeInTheDocument();
      expect(screen.getByTestId("a")).toBeInTheDocument();
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
