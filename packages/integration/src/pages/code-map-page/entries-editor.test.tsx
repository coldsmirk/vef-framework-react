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

    const { container } = render(
      <ConfigProvider>
        <CodeMapEntriesEditor />
      </ConfigProvider>
    );

    await user.click(screen.getByRole("button", { name: buttonName("新增记录") }));

    // Located by the tag-select class rather than by combobox role: the two
    // value columns are AutoComplete, which reports that role too, so the role
    // alone no longer identifies the alias editors.
    const aliasEditors = container.querySelectorAll(".vef-select-multiple");
    expect(aliasEditors).toHaveLength(2);

    for (const editor of aliasEditors) {
      expect(editor).toHaveStyle({ width: "100%" });
    }
  });

  it("offers the host catalog on both value columns", async () => {
    const user = userEvent.setup();
    const suggestions = [
      { label: "0 = 独立科室", value: "0" },
      { label: "1 = 一级科室", value: "1" }
    ];

    const { container } = render(
      <ConfigProvider>
        <CodeMapEntriesEditor codeSuggestions={suggestions} />
      </ConfigProvider>
    );

    await user.click(screen.getByRole("button", { name: buttonName("新增记录") }));

    // Two AutoComplete cells (canonical + external) and two plain tag inputs.
    // The external value suggests too: host and external codings overlap often
    // enough that offering the list saves typing, and the control suggests
    // rather than constrains.
    expect(container.querySelectorAll(".vef-select-auto-complete")).toHaveLength(2);
    expect(container.querySelectorAll(".vef-select-multiple")).toHaveLength(2);

    const [canonical] = container.querySelectorAll<HTMLInputElement>(":scope .vef-select-auto-complete .vef-select-input");
    await user.click(canonical!);

    // The dropdown shows `code = label`; picking it inserts the bare code.
    expect(await screen.findByTitle("0 = 独立科室")).toBeInTheDocument();
  });

  // A separate render on purpose: antd leaves a dropdown's portal mounted after
  // it closes, so opening the canonical one first would leave its options in the
  // document and make this assertion pass for the wrong reason.
  it("keeps the alias cells as plain tag inputs with no catalog dropdown", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ConfigProvider>
        <CodeMapEntriesEditor codeSuggestions={[{ label: "0 = 独立科室", value: "0" }]} />
      </ConfigProvider>
    );

    await user.click(screen.getByRole("button", { name: buttonName("新增记录") }));

    const [alias] = container.querySelectorAll<HTMLInputElement>(":scope .vef-select-multiple .vef-select-input");
    await user.click(alias!);

    // A full catalog list over a narrow multi-value cell covers half the form,
    // and aliases are the values that fall outside the catalog anyway.
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
