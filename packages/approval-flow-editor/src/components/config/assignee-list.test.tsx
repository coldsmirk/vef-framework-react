import type { FC } from "react";

import type { EditorPlugins, PickerProps } from "../../plugins";
import type { AssigneeDefinition } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EditorPluginsContext } from "../../plugins";
import { AssigneeList } from "./assignee-list";

/**
 * Stand-in for a host picker, identified by the text it renders so a test can
 * tell which registry key resolved it.
 */
function stubPicker(name: string): FC<PickerProps> {
  return () => <div>{`${name}选择器`}</div>;
}

function renderList(input: {
  value: AssigneeDefinition[];
  plugins?: EditorPlugins;
  onChange?: (next: AssigneeDefinition[]) => void;
}) {
  return render(
    <EditorPluginsContext value={input.plugins ?? {}}>
      <AssigneeList value={input.value} onChange={input.onChange ?? (() => undefined)} />
    </EditorPluginsContext>
  );
}

// The catalog is the application's, so a host kind must reach the editor with
// no change here — the whole point of the open registry on the backend.
const HOST_PLUGINS: EditorPlugins = {
  assigneeKinds: [
    {
      kind: "head_nurse",
      label: "护士长",
      selection: "none"
    },
    {
      kind: "expert_panel",
      label: "专家组",
      selection: "custom"
    },
    {
      kind: "ward_lead",
      label: "病区负责人",
      selection: "role"
    }
  ],
  pickers: {
    role: stubPicker("角色"),
    expert_panel: stubPicker("专家组")
  }
};

describe("AssigneeList kind catalog", () => {
  it("falls back to the framework built-ins when the host wires no catalog", () => {
    renderList({ value: [{ kind: "self", sortOrder: 1 }] });

    expect(screen.getByTitle("发起人本人")).toBeInTheDocument();
  });

  it("offers the application's kinds when the host supplies a catalog", () => {
    renderList({ value: [{ kind: "head_nurse", sortOrder: 1 }], plugins: HOST_PLUGINS });

    expect(screen.getByTitle("护士长")).toBeInTheDocument();
  });

  it("renders no input for a kind resolved from the applicant", () => {
    renderList({ value: [{ kind: "head_nurse", sortOrder: 1 }], plugins: HOST_PLUGINS });

    expect(screen.queryByText(/选择器/)).not.toBeInTheDocument();
    expect(screen.queryByText("字段标识")).not.toBeInTheDocument();
  });

  it("resolves a custom kind's picker by the kind's own name", () => {
    renderList({
      value: [
        {
          kind: "expert_panel",
          ids: [],
          sortOrder: 1
        }
      ],
      plugins: HOST_PLUGINS
    });

    expect(screen.getByText("专家组选择器")).toBeInTheDocument();
  });

  // A host kind that picks roles reuses the built-in role picker: the registry
  // is looked up by kind first, then by what the kind selects.
  it("falls back to the selection mode's picker for a host kind", () => {
    renderList({
      value: [
        {
          kind: "ward_lead",
          ids: [],
          sortOrder: 1
        }
      ],
      plugins: HOST_PLUGINS
    });

    expect(screen.getByText("角色选择器")).toBeInTheDocument();
  });

  it("reports a kind the application no longer registers", () => {
    renderList({
      value: [
        {
          kind: "retired_kind",
          ids: [],
          sortOrder: 1
        }
      ],
      plugins: HOST_PLUGINS
    });

    expect(screen.getByText("当前应用未注册该类型：retired_kind")).toBeInTheDocument();
  });

  it("seeds a new row from the first offered kind", async () => {
    const user = userEvent.setup();

    const onChange = vi.fn();
    renderList({
      value: [],
      plugins: HOST_PLUGINS,
      onChange
    });

    await user.click(screen.getByRole("button", { name: /添加处理人/ }));

    expect(onChange).toHaveBeenCalledWith([
      {
        kind: "head_nurse",
        ids: undefined,
        formField: undefined,
        sortOrder: 1
      }
    ]);
  });
});
