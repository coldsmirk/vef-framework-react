import type { ApiRequest } from "@vef-framework-react/core";
import type { FormSchema } from "@vef-framework-react/form-editor";

import type { ApprovalPlugins } from "./index";

import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { QUERY_CLIENT } from "@vef-framework-react/core";

import { mockApprovalApi, render, screen, waitFor, within } from "../../test-utils";
import { InstanceDetailPanel } from "../components/detail";
import { AdminInstanceDetailPanel } from "../components/detail/admin";
import { InstanceFormPanel } from "../components/form-panel";
import { StartInstanceDrawer } from "../pages/initiate-page/start-drawer";
import { ApprovalProvider } from "./index";

interface HostField {
  key: string;
  label: string;
  defaultValue?: string;
}

const flat = Object.freeze({ fields: Object.freeze([Object.freeze({ key: "amount", label: "Budget" })]) });

function toSchema(fields: readonly HostField[]): FormSchema {
  return {
    id: "budget",
    version: 2,
    presentations: {
      pc: {
        children: fields.map(({ key, label }) => {
          return {
            key,
            label,
            id: key,
            type: "textfield"
          };
        })
      }
    },
    linkage: {
      rules: fields.flatMap(({ key, defaultValue }) => defaultValue === undefined
        ? []
        : [
            {
              id: `default-${key}`,
              trigger: { kind: "load" },
              actions: [
                {
                  type: "set_field",
                  targetKey: key,
                  value: { kind: "literal", value: defaultValue }
                }
              ]
            }
          ])
    }
  };
}

const native = toSchema(flat.fields);

const adapt: NonNullable<ApprovalPlugins["formSchemaAdapter"]> = document => {
  if (!document || typeof document !== "object") {
    return;
  }

  if ("presentations" in document) {
    return document as FormSchema;
  }

  if ("fields" in document && Array.isArray(document.fields)) {
    return toSchema(document.fields);
  }
};

const applicant = { id: "u", name: "Applicant" };

type Panel = "my" | "admin" | "start" | "returned";

function setup(panel: Panel, formSchema: unknown, formSchemaAdapter?: ApprovalPlugins["formSchemaAdapter"], businessKind?: string) {
  const writes: ApiRequest[] = [];
  const apiClient = mockApprovalApi(request => {
    if (request.action === "get_start_form") {
      return {
        flowName: "Budget approval",
        version: 1,
        applicant,
        businessKind,
        formSchema
      };
    }

    if (request.action === "get_instance_detail") {
      return {
        instance: {
          instanceId: "i",
          instanceNo: "1",
          flowId: "budget",
          flowCode: "budget",
          title: "Budget request",
          flowName: "Budget approval",
          applicant,
          businessKind,
          status: panel === "returned" ? "returned" : "running",
          createdAt: "2026-11-18",
          formData: { amount: "125" },
          ...(panel === "admin") && { tenantId: "t" }
        },
        availableActions: panel === "my" ? ["approve"] : panel === "returned" ? ["resubmit"] : [],
        myTask: panel === "my" ? { taskId: "task", nodeId: "node" } : undefined,
        formSchema,
        fieldPermissions: { amount: "editable" },
        timeline: [],
        flowGraph: { nodes: [], edges: [] },
        annotations: [
          {
            id: "note",
            instanceId: "i",
            nodeId: "node",
            nodeName: "Review",
            author: applicant,
            status: "published",
            content: "Verify amount",
            audience: { scope: "participants" },
            anchor: { field: "amount" }
          }
        ]
      };
    }

    writes.push(request);
  });
  const children = panel === "start"
    ? <StartInstanceDrawer flowCode="budget" onClose={vi.fn()} />
    : panel === "admin" ? <AdminInstanceDetailPanel instanceId="i" /> : <InstanceDetailPanel instanceId="i" />;
  const withPlugins = (plugins: ApprovalPlugins) => <ApprovalProvider plugins={plugins}>{children}</ApprovalProvider>;
  const { rerender } = render(withPlugins({ formSchemaAdapter }), { apiClient });

  return {
    writes,
    cache: apiClient[QUERY_CLIENT],
    rerenderPlugins: (plugins: ApprovalPlugins) => rerender(withPlugins(plugins))
  };
}

describe("runtime form schema adaptation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adapts a host document supplied directly to InstanceFormPanel", () => {
    render(<ApprovalProvider plugins={{ formSchemaAdapter: adapt }}><InstanceFormPanel schema={flat as unknown as FormSchema} /></ApprovalProvider>);
    expect(screen.getByRole("textbox", { name: "Budget" })).toBeVisible();
  });

  it("renders the direct panel's empty state and resolves the document again when its adapter changes", () => {
    const panel = <InstanceFormPanel schema={{ unsupported: true } as unknown as FormSchema} />;
    const { rerender } = render(<ApprovalProvider plugins={{ formSchemaAdapter: adapt }}>{panel}</ApprovalProvider>);
    expect(screen.getByText("该流程未配置表单")).toBeVisible();
    rerender(<ApprovalProvider plugins={{ formSchemaAdapter: () => native }}>{panel}</ApprovalProvider>);
    expect(screen.getByRole("textbox", { name: "Budget" })).toBeVisible();
  });

  it("shares one conversion across the detail, annotation views and unrelated provider updates", async () => {
    const adapter = vi.fn(adapt);
    const { rerenderPlugins } = setup("my", flat, adapter);
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const input = await screen.findByRole("textbox", { name: "Budget" });
    await user.clear(input);
    await user.type(input, "275");
    await user.type(screen.getByPlaceholderText("请输入审批意见"), "Review");
    rerenderPlugins({ formSchemaAdapter: adapter, globalSubjects: [] });
    expect(screen.getByRole("textbox", { name: "Budget" })).toBe(input);
    expect(input).toHaveValue("275");

    await user.click(screen.getByRole("button", { name: "1 条批注" }));
    const dialog = await screen.findByRole("dialog", { name: "Budget · 批注" });
    expect(within(dialog).getByText("Verify amount")).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeVisible());
    await user.click(screen.getByRole("button", { name: "添加批注" }));
    await user.click(screen.getByRole("combobox", { name: "批注位置" }));
    expect(await screen.findByRole("option", { name: "Budget" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("tab", { name: "流转记录" }));
    expect(within(await screen.findByRole("tabpanel", { name: "流转记录" })).getByText("Budget")).toBeVisible();
    expect(adapter).toHaveBeenCalledExactlyOnceWith(flat);
  });

  it("submits the adapted field's default from the start drawer without typing", async () => {
    const { writes } = setup("start", { fields: [{ ...flat.fields[0], defaultValue: "350" }] }, adapt);
    const user = userEvent.setup();
    const input = await screen.findByRole("textbox", { name: "Budget" });
    await waitFor(() => expect(input).toHaveValue("350"));
    await user.click(screen.getByRole("button", { name: "提交审批" }));
    await waitFor(() => expect(writes[0]).toMatchObject({ action: "start", params: { formData: { amount: "350" } } }));
  });

  it("resubmits the edited adapted form on a returned instance", async () => {
    const { writes } = setup("returned", flat, adapt);
    const user = userEvent.setup();
    const input = await screen.findByRole("textbox", { name: "Budget" });
    await user.clear(input);
    await user.type(input, "250");
    await user.click(screen.getByRole("button", { name: "重新提交" }));
    await waitFor(() => expect(writes[0]).toMatchObject({ action: "resubmit", params: { instanceId: "i", formData: { amount: "250" } } }));
  });

  it("resubmits a returned instance without form data when its document is unsupported", async () => {
    const adapter = vi.fn(adapt);
    const { writes } = setup("returned", { unsupported: true }, adapter);
    const user = userEvent.setup();
    expect(await screen.findByText("该流程未配置表单")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重新提交" }));
    await waitFor(() => expect(writes[0]).toMatchObject({ action: "resubmit", params: { instanceId: "i" } }));
    expect(writes[0]?.params?.formData).toBeUndefined();
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("skips the form adapter on personal business instance details", async () => {
    const adapter = vi.fn(adapt);
    setup("my", flat, adapter, "budget");
    expect(await screen.findByText("该业务类型未在本应用注册")).toBeVisible();
    expect(adapter).not.toHaveBeenCalled();
  });

  it("skips the form adapter on admin business instance details", async () => {
    const adapter = vi.fn(adapt);
    setup("admin", flat, adapter, "budget");
    expect(await screen.findByText("该业务类型未在本应用注册")).toBeVisible();
    expect(adapter).not.toHaveBeenCalled();
  });

  it("skips the form adapter on business start forms", async () => {
    const adapter = vi.fn(adapt);
    setup("start", flat, adapter, "budget");
    expect(await screen.findByText("该业务类型未在本应用注册")).toBeVisible();
    expect(adapter).not.toHaveBeenCalled();
  });

  describe.each([
    {
      name: "flat host document",
      document: flat,
      adapter: adapt
    },
    {
      name: "native document without an adapter",
      document: native,
      adapter: undefined
    }
  ])("$name", ({ document, adapter }) => {
    async function openDetailTimeline(panel: "my" | "admin") {
      const { cache } = setup(panel, document, adapter);
      const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
      expect(await screen.findByRole("textbox", { name: "Budget" })).toHaveValue("125");
      expect(cache.getQueryCache().getAll().some(query => (query.state.data as { formSchema?: unknown })?.formSchema === document)).toBe(true);
      await user.click(screen.getByRole("button", { name: "1 条批注" }));
      const dialog = await screen.findByRole("dialog", { name: "Budget · 批注" });
      expect(within(dialog).getByText("Verify amount")).toBeVisible();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(dialog).not.toBeVisible());

      await user.click(screen.getByRole("tab", { name: "流转记录" }));
      return screen.findByRole("tabpanel", { name: "流转记录" });
    }

    it("renders the personal detail form and resolves field anchors", async () => {
      const timeline = await openDetailTimeline("my");
      expect(within(timeline).getByText("Budget")).toBeVisible();
    });

    it("renders the admin detail form and resolves field anchors", async () => {
      const timeline = await openDetailTimeline("admin");
      expect(within(timeline).getByText("Budget")).toBeVisible();
    });

    it("offers the projected field in the annotation composer", async () => {
      setup("my", document, adapter);
      const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
      await user.click(await screen.findByRole("button", { name: "添加批注" }));
      await user.click(screen.getByRole("combobox", { name: "批注位置" }));
      expect(await screen.findByRole("option", { name: "Budget" })).toBeInTheDocument();
    });

    it("starts the flow using the rendered field", async () => {
      const { writes } = setup("start", document, adapter);
      const user = userEvent.setup();
      await user.type(await screen.findByRole("textbox", { name: "Budget" }), "125");
      await user.click(screen.getByRole("button", { name: "提交审批" }));
      await waitFor(() => expect(writes[0]).toMatchObject({ action: "start", params: { formData: { amount: "125" } } }));
    });
  });

  it("shows the admin empty state for an unsupported document", async () => {
    setup("admin", { unsupported: true }, adapt);
    expect(await screen.findByText("该流程未配置表单")).toBeVisible();
    expect(screen.queryByRole("button", { name: "1 条批注" })).not.toBeInTheDocument();
  });

  it("offers no annotation fields and submits a decision without a renderer for an unsupported document", async () => {
    const { writes } = setup("my", { unsupported: true }, adapt);
    const user = userEvent.setup();
    expect(await screen.findByText("该流程未配置表单")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "添加批注" }));
    expect(screen.queryByRole("combobox", { name: "批注位置" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /通\s*过/ }));
    await waitFor(() => expect(writes[0]).toMatchObject({ action: "process_task" }));
  });

  it("starts without a renderer for an unsupported document", async () => {
    const { writes } = setup("start", { unsupported: true }, adapt);
    const user = userEvent.setup();
    expect(await screen.findByText("该流程未配置表单")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "提交审批" }));
    await waitFor(() => expect(writes[0]).toMatchObject({ action: "start" }));
  });
});
