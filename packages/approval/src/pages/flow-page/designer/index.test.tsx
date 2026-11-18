import type * as FlowEditorModule from "@vef-framework-react/approval-flow-editor";
import type { ApiRequest } from "@vef-framework-react/core";
import type * as FormEditorModule from "@vef-framework-react/form-editor";

import type { Flow } from "../../../types";

import userEvent from "@testing-library/user-event";

import { mockApprovalApi, render, screen, waitFor } from "../../../../test-utils";
import { FlowDesignerDrawer } from "./index";

vi.mock("@vef-framework-react/form-editor", async importOriginal => {
  return {
    ...await importOriginal<typeof FormEditorModule>(),
    FormEditor: () => <div>流程表单编辑器</div>
  };
});
vi.mock("@vef-framework-react/approval-flow-editor", async importOriginal => {
  return {
    ...await importOriginal<typeof FlowEditorModule>(),
    ApprovalFlowEditor: () => null
  };
});

describe("business kind design", () => {
  afterEach(() => vi.restoreAllMocks());

  it("replaces form design with the registered catalog and deploys only JSON storage", async () => {
    const user = userEvent.setup();
    const flow: Flow = {
      id: "f",
      tenantId: "t",
      isShared: false,
      code: "meet",
      name: "会议",
      categoryId: "c",
      adminUserIds: [],
      isAllInitiationAllowed: true,
      instanceTitleTemplate: "会议申请",
      isActive: true,
      currentVersion: 1
    };
    const writes: ApiRequest[] = [];
    const apiClient = mockApprovalApi(req => {
      if (["update", "deploy", "publish_version"].includes(req.action)) {
        writes.push(req);
        return { id: "f" };
      }

      switch (req.action) {
        case "find_versions": { return [{ id: "v" }]; }

        case "get_graph": { return {
          version: {
            storageMode: "table",
            flowSchema: {
              nodes: [{ id: "start", kind: "start" }, { id: "end", kind: "end" }],
              edges: [
                {
                  id: "edge",
                  source: "start",
                  target: "end"
                }
              ]
            }
          }
        }; }

        case "list_business_kinds": { return [
          {
            kind: "meeting",
            label: "会议预订",
            formFields: [
              {
                key: "chair",
                kind: "input",
                label: "主持人",
                sortOrder: 0
              }
            ]
          }
        ]; }

        case "list_kind_options": { return {
          assignees: [],
          ccs: [],
          initiators: []
        }; }

        default: { return []; }
      }
    });
    render(<FlowDesignerDrawer open flow={flow} tenantId="t" onClose={vi.fn()} />, { apiClient });
    expect(await screen.findByText("表单设计")).toBeVisible();
    await user.click(screen.getByRole("combobox", { name: "业务类型" }));
    await user.click(await screen.findByText("会议预订"));
    expect(screen.queryByText("流程表单编辑器")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "回写审批状态到业务表" })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByText("业务字段目录")).toBeVisible();
    expect(screen.getAllByText("主持人")[0]).toBeVisible();
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "部署并发布" }));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[0]?.params).toMatchObject({ businessKind: "meeting" });
    expect(writes[1]?.params).toMatchObject({ storageMode: "json" });
    expect(writes[1]?.params?.formSchema).toBeUndefined();
  });
});
