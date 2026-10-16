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

const TENANTS = [
  { value: "org-a", label: "A 机构" },
  { value: "org-b", label: "B 机构" }
];

/**
 * A picker that shows the tenant it was handed, so a test can tell what the
 * row passed down.
 */
const TenantEchoPicker: FC<PickerProps> = ({ tenantId }) => <div>{`选择器·${tenantId ?? "无机构"}`}</div>;

describe("AssigneeList in a shared flow", () => {
  const sharedPlugins: EditorPlugins = {
    shared: true,
    tenants: TENANTS,
    pickers: {
      user: TenantEchoPicker,
      department: TenantEchoPicker,
      role: stubPicker("角色")
    }
  };

  it("offers every kind, the ones picking specific people included", async () => {
    const user = userEvent.setup();

    renderList({ value: [{ kind: "self", sortOrder: 1 }], plugins: sharedPlugins });

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByTitle("指定用户")).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTitle("指定角色")).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTitle("指定部门")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("asks for the tenant before listing users", () => {
    renderList({ value: [{ kind: "user", sortOrder: 1 }], plugins: sharedPlugins });

    expect(screen.getByText("机构")).toBeInTheDocument();
    expect(screen.getByText("选择器·无机构")).toBeInTheDocument();
  });

  it("hands the chosen tenant to the picker", () => {
    renderList({
      value: [
        {
          kind: "user",
          tenantId: "org-b",
          sortOrder: 1
        }
      ],
      plugins: sharedPlugins
    });

    expect(screen.getByText("选择器·org-b")).toBeInTheDocument();
  });

  it("asks for the tenant before listing departments too", () => {
    renderList({ value: [{ kind: "department", sortOrder: 1 }], plugins: sharedPlugins });

    expect(screen.getByText("机构")).toBeInTheDocument();
  });

  it("clears the ids when the tenant changes", async () => {
    const user = userEvent.setup();

    const onChange = vi.fn();
    renderList({
      value: [
        {
          kind: "user",
          ids: ["user-1"],
          tenantId: "org-a",
          sortOrder: 1
        }
      ],
      plugins: sharedPlugins,
      onChange
    });

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

  it("keeps the tenant when the row switches between users and departments", async () => {
    const user = userEvent.setup();

    const onChange = vi.fn();
    renderList({
      value: [
        {
          kind: "user",
          ids: ["user-1"],
          tenantId: "org-a",
          sortOrder: 1
        }
      ],
      plugins: sharedPlugins,
      onChange
    });

    await user.click(screen.getAllByRole("combobox")[0]!);
    await user.click(await screen.findByTitle("指定部门"));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "department",
        ids: [],
        tenantId: "org-a"
      })
    ]);
  });

  it("drops the tenant when the row switches to a kind that is not per tenant", async () => {
    const user = userEvent.setup();

    const onChange = vi.fn();
    renderList({
      value: [
        {
          kind: "user",
          ids: ["user-1"],
          tenantId: "org-a",
          sortOrder: 1
        }
      ],
      plugins: sharedPlugins,
      onChange
    });

    await user.click(screen.getAllByRole("combobox")[0]!);
    await user.click(await screen.findByTitle("指定角色"));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "role",
        ids: [],
        tenantId: undefined
      })
    ]);
  });

  it("picks roles without a tenant", () => {
    renderList({ value: [{ kind: "role", sortOrder: 1 }], plugins: sharedPlugins });

    expect(screen.queryByText("机构")).not.toBeInTheDocument();
    expect(screen.getByText("角色选择器")).toBeInTheDocument();
  });

  it("picks users through the plain picker when the host lists no tenants", () => {
    renderList({
      value: [{ kind: "user", sortOrder: 1 }],
      plugins: { ...sharedPlugins, tenants: undefined }
    });

    expect(screen.queryByText("机构")).not.toBeInTheDocument();
    expect(screen.getByText("选择器·无机构")).toBeInTheDocument();
  });
});

describe("AssigneeList in an ordinary flow", () => {
  it("picks users without a tenant even when the host lists tenants", () => {
    renderList({
      value: [{ kind: "user", sortOrder: 1 }],
      plugins: { tenants: TENANTS, pickers: { user: TenantEchoPicker } }
    });

    expect(screen.queryByText("机构")).not.toBeInTheDocument();
    expect(screen.getByText("选择器·无机构")).toBeInTheDocument();
  });
});
