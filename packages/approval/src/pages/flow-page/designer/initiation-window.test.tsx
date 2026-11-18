import type * as FlowEditorModule from "@vef-framework-react/approval-flow-editor";
import type { WindowRule } from "@vef-framework-react/calendar";
import type { ApiRequest } from "@vef-framework-react/core";
import type * as FormEditorModule from "@vef-framework-react/form-editor";

import type { Flow } from "../../../types";

import userEvent from "@testing-library/user-event";
import { HTTP_CLIENT } from "@vef-framework-react/core";

import { FlowDesignerDrawer } from ".";
import { createTestApiClient, render, screen } from "../../../../test-utils";

vi.mock("@vef-framework-react/form-editor", async importOriginal => {
  return { ...await importOriginal<typeof FormEditorModule>(), FormEditor: () => null };
});
vi.mock("@vef-framework-react/approval-flow-editor", async importOriginal => {
  return { ...await importOriginal<typeof FlowEditorModule>(), ApprovalFlowEditor: () => null };
});

const equalTimes = [{ startsAt: "08:00:00", endsAt: "08:00:00" }];

async function setup(initiationWindow: WindowRule) {
  const flow: Flow = {
    id: "flow",
    tenantId: "tenant",
    categoryId: "general",
    isShared: false,
    code: "leave",
    name: "请假",
    adminUserIds: [],
    isAllInitiationAllowed: true,
    instanceTitleTemplate: "请假申请",
    isActive: true,
    currentVersion: 0,
    initiationWindow
  };
  const apiClient = createTestApiClient();
  vi.spyOn(Object.getPrototypeOf(apiClient[HTTP_CLIENT]), "post").mockImplementation((_url, options) => {
    const { action } = (options as { data: ApiRequest }).data;

    if (action === "preview_windows") {
      return { data: { status: { open: false }, windows: [] } };
    }

    if (action === "list_kind_options") {
      return {
        data: {
          assignees: [],
          ccs: [],
          initiators: []
        }
      };
    }

    return { data: [] };
  });
  render(<FlowDesignerDrawer open flow={flow} tenantId={flow.tenantId} onClose={vi.fn()} />, { apiClient });
  const label = await screen.findByText("下一步");
  return label.closest("button")!;
}

describe("flow designer initiation window", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires an open window while the initiation period is restricted", async () => {
    const user = userEvent.setup();
    const next = await setup({ windows: [{}] });
    expect(next).toBeEnabled();
    await user.click(screen.getByLabelText("删除开放窗口 1"));
    expect(next).toBeDisabled();
    expect(screen.getByText("请至少添加一个开放窗口")).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "不限" }));
    expect(next).toBeEnabled();
  });

  it("blocks equal endpoints in an open window until the range is removed", async () => {
    const user = userEvent.setup();
    const next = await setup({ windows: [{ times: equalTimes }] });
    expect(next).toBeDisabled();
    await user.click(screen.getByText("移除时段"));
    expect(next).toBeEnabled();
  });

  it("checks blackout endpoints and accepts an overnight open window", async () => {
    const user = userEvent.setup();
    const next = await setup({ windows: [{ times: [{ startsAt: "22:00:00", endsAt: "07:00:00" }] }], blackouts: [{ times: equalTimes }] });
    expect(next).toBeDisabled();
    await user.click(screen.getByLabelText("删除例外关闭窗口 1"));
    expect(next).toBeEnabled();
  });
});
