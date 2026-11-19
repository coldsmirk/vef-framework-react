import type * as FlowEditorModule from "@vef-framework-react/approval-flow-editor";
import type { ApiRequest } from "@vef-framework-react/core";
import type * as FormEditorModule from "@vef-framework-react/form-editor";

import type { Flow } from "../../../types";

import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";

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
    ApprovalFlowEditor: ({ plugins }: FlowEditorModule.ApprovalFlowEditorProps) => <div>{plugins?.formFields === undefined ? "目录尚未加载" : `目录已加载（${plugins.formFields.length}）`}</div>

  };
});

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

function renderBusinessDesigner(initialFlow: Flow) {
  const writes: ApiRequest[] = [];
  const lookups: ApiRequest[] = [];
  const apiClient = mockApprovalApi(req => {
    if (["update", "deploy", "publish_version"].includes(req.action)) {
      writes.push(req);
      return { id: "f" };
    }

    switch (req.action) {
      case "find_flows": {
        lookups.push(req);
        const flows = [
          {
            code: "meet",
            name: "会议共享作废",
            businessKind: "approval.void_request"
          },
          {
            code: "leave",
            name: "年假办理流程",
            businessKind: "leave"
          },
          ...Array.from({ length: 30 }, (_, index) => {
            return {
              code: `void-${index}`,
              name: `其他作废流程 ${index + 1}`,
              businessKind: "approval.void_request"
            };
          }),
          {
            code: "cancel",
            name: "会议作废流程",
            businessKind: "approval.void_request"
          }
        ];
        const {
          keyword,
          businessKind,
          page,
          pageSize
        } = req.params!;
        const matches = flows.filter(item => item.businessKind === businessKind && item.name.includes(String(keyword ?? "")));
        const offset = (Number(page) - 1) * Number(pageSize);
        return { total: matches.length, items: matches.slice(offset, offset + Number(pageSize)) };
      }

      case "find_versions": { return [{ id: "v" }]; }

      case "get_graph": { return {
        version: {
          storageMode: "table",
          flowSchema: {
            nodes: [
              { id: "start", kind: "start" },
              {
                id: "a",
                kind: "approval",
                data: { rollbackDataStrategy: "keep" }
              },
              { id: "end", kind: "end" }
            ],
            edges: [
              {
                id: "edge",
                source: "start",
                target: "a"
              },
              {
                id: "edge-2",
                source: "a",
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
          isVoidable: true,
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
  render(<FlowDesignerDrawer open flow={initialFlow} tenantId="t" onClose={vi.fn()} />, { apiClient });
  return { writes, lookups };
}

describe("business kind design", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves an unavailable business catalog until the server returns its fields", async () => {
    const catalog = Promise.withResolvers<unknown>();
    const apiClient = mockApprovalApi(({ action }) => {
      if (action === "list_business_kinds") {
        return catalog.promise;
      }

      return action === "list_kind_options"
        ? {
            assignees: [],
            ccs: [],
            initiators: []
          }
        : [];
    });
    render(<FlowDesignerDrawer open flow={{ ...flow, businessKind: "meeting" }} tenantId="t" onClose={vi.fn()} />, { apiClient });
    expect(await screen.findByText("目录尚未加载")).toBeInTheDocument();
    expect(screen.queryByText("该业务类型不支持作废。")).not.toBeInTheDocument();
    const next = screen.getByText("下一步").closest("button");
    expect(next).toBeDisabled();
    catalog.resolve([
      {
        kind: "meeting",
        label: "会议预订",
        isVoidable: false,
        formFields: []
      }
    ]);
    expect(await screen.findByText("目录已加载（0）")).toBeInTheDocument();
    expect(screen.getByText("该业务类型不支持作废。")).toBeVisible();
    expect(next).toBeEnabled();
  });

  it("stops loading and explains a failed business catalog beside the picker", async () => {
    const catalog = Promise.withResolvers<unknown>();
    const apiClient = mockApprovalApi(({ action }) => action === "list_business_kinds" ? catalog.promise : []);
    render(<FlowDesignerDrawer open tenantId="t" onClose={vi.fn()} />, { apiClient });
    const picker = await screen.findByRole("combobox", { name: "业务类型" });
    expect(picker).toHaveAttribute("aria-busy", "true");
    catalog.reject(new Error("目录服务暂不可用"));
    expect(await screen.findByText("业务类型加载失败：目录服务暂不可用")).toBeVisible();
    expect(picker).toHaveAttribute("aria-busy", "false");
  });

  it("checks a form title reference on the form step and allows advancing after correction", async () => {
    const user = userEvent.setup();
    const apiClient = mockApprovalApi(({ action }) => {
      switch (action) {
        case "find_versions": { return [{ id: "v" }]; }

        case "get_graph": { return {
          version: {
            formSchema: {
              version: 2,
              id: "form",
              presentations: {
                pc: {
                  children: [
                    {
                      id: "name",
                      key: "name",
                      label: "名称",
                      type: "textfield"
                    }
                  ]
                }
              }
            }
          }
        }; }

        case "list_kind_options": { return {
          assignees: [],
          ccs: [],
          initiators: []
        }; }

        default: { return []; }
      }
    });
    render(<FlowDesignerDrawer open flow={{ ...flow, instanceTitleTemplate: "{{.formData.typo}}" }} tenantId="t" onClose={vi.fn()} />, { apiClient });
    const nextLabel = await screen.findByText("下一步");
    const next = nextLabel.closest("button")!;
    expect(next).toBeEnabled();
    await user.click(next);
    expect(screen.getByText("单据标题引用的字段「typo」不在表单中")).toBeVisible();
    expect(next).toBeDisabled();
    await user.click(screen.getByText("上一步"));
    const title = screen.getByDisplayValue("{{.formData.typo}}");
    await user.clear(title);
    await user.paste("{{.formData.name}}");
    await user.click(next);
    expect(next).toBeEnabled();
    expect(screen.queryByText(/字段「typo」/)).not.toBeInTheDocument();
  });

  it("keeps the selected void flow across searches and resolves its code across pages", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const { lookups } = renderBusinessDesigner({ ...flow, businessKind: "meeting" });
    await user.click(await screen.findByLabelText("审批后作废"));
    const next = screen.getByText("下一步").closest("button")!;
    expect(next).toBeDisabled();
    const picker = screen.getByLabelText("作废申请流程");
    await user.click(picker);
    await user.paste("会议");
    const option = await screen.findByText("会议作废流程");
    expect(screen.queryByText("会议共享作废")).not.toBeInTheDocument();
    expect(screen.queryByText("年假办理流程")).not.toBeInTheDocument();
    await user.click(option);
    await waitFor(() => expect(next).toBeEnabled());
    expect(lookups).toContainEqual(expect.objectContaining({
      params: expect.objectContaining({
        businessKind: "approval.void_request",
        tenantId: "t",
        includeShared: true,
        keyword: "会议"
      })
    }));
    expect(lookups).toContainEqual(expect.objectContaining({ params: expect.objectContaining({ page: 2, businessKind: "approval.void_request" }) }));
    await user.click(picker);
    await user.paste("其他");
    await screen.findByText("其他作废流程 1");
    expect(screen.getByRole("option", { name: "会议作废流程" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
  });

  it("replaces form design with the registered catalog and deploys only JSON storage", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const { writes } = renderBusinessDesigner({
      ...flow,
      voidPolicy: "approval",
      voidFlowCode: "cancel"
    });
    expect(await screen.findByText("表单设计")).toBeVisible();
    await user.click(screen.getByLabelText("业务类型"));
    await user.click(await screen.findByText("会议预订"));
    const next = screen.getByText("下一步").closest("button")!;
    await waitFor(() => expect(next).toBeEnabled());
    expect(screen.queryByText("流程表单编辑器")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "回写审批状态到业务表" })).not.toBeChecked();
    await user.click(next);
    expect(screen.getByText("业务字段目录")).toBeVisible();
    expect(screen.getAllByText("主持人")[0]).toBeVisible();
    await user.click(next);
    await user.click(next);
    await user.click(screen.getByText("部署并发布"));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[0]?.params).toMatchObject({
      businessKind: "meeting",
      voidPolicy: "approval",
      voidFlowCode: "cancel"
    });
    expect(writes[1]?.params).toMatchObject({ storageMode: "json" });
    expect(writes[1]?.params?.formSchema).toBeUndefined();
    expect(writes[1]?.params?.flowDefinition).toMatchObject({ nodes: [{}, { id: "a", data: {} }, {}] });
    expect(JSON.stringify(writes[1]?.params?.flowDefinition)).not.toContain("rollbackDataStrategy");
  });
});
