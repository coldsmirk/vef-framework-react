import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";
import { describe, expect, it } from "vitest";

import { CodeMapEntriesEditor } from "./entries-editor";

function buttonName(text: string): RegExp {
  return new RegExp(`^${[...text].join(String.raw`\s*`)}$`);
}

describe("CodeMapEntriesEditor", () => {
  it("reserves the operation column while alias columns absorb remaining space", () => {
    const { container } = render(
      <ConfigProvider>
        <CodeMapEntriesEditor />
      </ConfigProvider>
    );

    const columnGroups = container.querySelectorAll("colgroup");
    expect(columnGroups.length).toBeGreaterThan(0);

    for (const group of columnGroups) {
      const columns = group.querySelectorAll<HTMLTableColElement>("col");
      expect(columns).toHaveLength(5);
      expect(columns.item(0)).toHaveStyle({ width: "120px" });
      expect(columns.item(1)).not.toHaveAttribute("style");
      expect(columns.item(2)).toHaveStyle({ width: "120px" });
      expect(columns.item(3)).not.toHaveAttribute("style");
      expect(columns.item(4)).toHaveStyle({ width: "160px" });
    }
  });

  it("stretches both alias editors to fill their table cells", async () => {
    const user = userEvent.setup();

    render(
      <ConfigProvider>
        <CodeMapEntriesEditor />
      </ConfigProvider>
    );

    await user.click(screen.getByRole("button", { name: buttonName("新增记录") }));

    const aliasEditors = screen.getAllByRole("combobox");
    expect(aliasEditors).toHaveLength(2);

    for (const editor of aliasEditors) {
      expect(editor.closest(".vef-select")).toHaveStyle({ width: "100%" });
    }
  });
});
