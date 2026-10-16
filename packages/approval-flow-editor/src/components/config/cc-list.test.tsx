import type { FC } from "react";

import type { EditorPlugins, PickerProps } from "../../plugins";
import type { CcDefinition } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EditorPluginsContext } from "../../plugins";
import { CcList } from "./cc-list";

const TenantEchoPicker: FC<PickerProps> = ({ tenantId }) => <div>{`选择器·${tenantId ?? "无机构"}`}</div>;

const SHARED_PLUGINS: EditorPlugins = {
  shared: true,
  tenants: [
    { value: "org-a", label: "A 机构" },
    { value: "org-b", label: "B 机构" }
  ],
  pickers: { user: TenantEchoPicker }
};

function renderList(input: {
  value: CcDefinition[];
  plugins?: EditorPlugins;
  onChange?: (next: CcDefinition[]) => void;
}) {
  return render(
    <EditorPluginsContext value={input.plugins ?? {}}>
      <CcList value={input.value} onChange={input.onChange ?? (() => undefined)} />
    </EditorPluginsContext>
  );
}

describe("CcList in a shared flow", () => {
  it("seeds a new row from the first kind, the ones picking specific people included", async () => {
    const user = userEvent.setup();

    const onChange = vi.fn();
    renderList({
      value: [],
      plugins: SHARED_PLUGINS,
      onChange
    });

    await user.click(screen.getByRole("button", { name: /添加抄送人/ }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ kind: "user" })]);
  });

  it("asks for the tenant before listing users", () => {
    renderList({ value: [{ kind: "user" }], plugins: SHARED_PLUGINS });

    expect(screen.getByText("机构")).toBeInTheDocument();
    expect(screen.getByText("选择器·无机构")).toBeInTheDocument();
  });

  it("hands the chosen tenant to the picker and clears the ids when it changes", async () => {
    const user = userEvent.setup();

    const onChange = vi.fn();
    renderList({
      value: [
        {
          kind: "user",
          ids: ["user-1"],
          tenantId: "org-a"
        }
      ],
      plugins: SHARED_PLUGINS,
      onChange
    });

    expect(screen.getByText("选择器·org-a")).toBeInTheDocument();

    await user.click(screen.getAllByRole("combobox")[1]!);
    await user.click(await screen.findByTitle("B 机构"));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "user",
        ids: [],
        tenantId: "org-b"
      })
    ]);
  });
});
