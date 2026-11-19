import type { ApiRequest } from "@vef-framework-react/core";
import type { FormSchema } from "@vef-framework-react/form-editor";

import type { ApprovalPlugins } from "./index";

import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { QUERY_CLIENT } from "@vef-framework-react/core";

import { mockApprovalApi, render, screen, waitFor, within } from "../../test-utils";
import { InstanceDetailPanel } from "../components/detail";
import { AdminInstanceDetailPanel } from "../components/detail/admin";
import { StartInstanceDrawer } from "../pages/initiate-page/start-drawer";
import { ApprovalProvider } from "./index";

const flat = { fields: [{ key: "amount", label: "Budget" }] };

function toSchema(fields: typeof flat.fields): FormSchema {
  return {
    id: "budget",
    version: 2,
    presentations: {
      pc: {
        children: fields.map(field => {
          return {
            ...field,
            id: field.key,
            type: "textfield"
          };
        })
      }
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

type Panel = "my" | "admin" | "start";

function setup(panel: Panel, formSchema: unknown, formSchemaAdapter?: ApprovalPlugins["formSchemaAdapter"]) {
  const writes: ApiRequest[] = [];
  const apiClient = mockApprovalApi(request => {
    if (request.action === "get_start_form") {
      return {
        flowName: "Budget approval",
        version: 1,
        applicant,
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
          status: "running",
          createdAt: "2026-11-18",
          formData: { amount: "125" },
          ...(panel === "admin") && { tenantId: "t" }
        },
        availableActions: panel === "my" ? ["approve"] : [],
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
  render(
    <ApprovalProvider plugins={{ formSchemaAdapter }}>
      {panel === "start"
        ? <StartInstanceDrawer flowCode="budget" onClose={vi.fn()} />
        : panel === "admin" ? <AdminInstanceDetailPanel instanceId="i" /> : <InstanceDetailPanel instanceId="i" />}
    </ApprovalProvider>,
    { apiClient }
  );

  return { writes, cache: apiClient[QUERY_CLIENT] };
}

describe("runtime form schema adaptation", () => {
  afterEach(() => vi.restoreAllMocks());

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
    it.each(["my", "admin"] as const)("renders the %s panel and resolves field anchors", async panel => {
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
      const timeline = within(await screen.findByRole("tabpanel", { name: "流转记录" }));
      expect(timeline.getByText("Budget")).toBeVisible();
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
