import type { ApiRequest } from "@vef-framework-react/core";
import type { ReactNode } from "react";

import type { ApprovalPlugins } from "../../plugins";
import type { MyInstanceDetail, VoidRecord } from "../../types";

import userEvent from "@testing-library/user-event";

import { mockApprovalApi, render, screen, waitFor, within } from "../../../test-utils";
import { ApprovalProvider } from "../../plugins";
import { VOID_REQUEST_KIND } from "../../types";
import { InstanceDetailPanel } from "../detail";
import { AdminInstanceDetailPanel } from "../detail/admin";
import { InstanceStatusTag } from "../status";

const person = { id: "user", name: "周宁" };
const target = {
  instanceId: "i",
  instanceNo: "会议-8",
  title: "预算会议",
  flowName: "会议预订",
  flowCode: "meeting",
  flowId: "flow",
  applicant: person,
  status: "approved" as const,
  createdAt: "2026-11-18",
  finishedAt: "2026-11-18",
  businessKind: "meeting",
  voidFlowCode: "void-flow"
};
const base = {
  instance: target,
  annotations: [],
  flowGraph: { nodes: [], edges: [] },
  timeline: []
};
const record: VoidRecord = {
  id: "v",
  tenantId: "t",
  instanceId: "i",
  requestInstanceId: "req",
  status: "requested",
  reason: "场地变更",
  operator: person,
  reversals: [],
  followUps: []
};
const plan = {
  blockers: [],
  reversals: ["释放会议室"],
  followUps: ["通知参会人"]
};
const request: MyInstanceDetail = {
  ...base,
  instance: {
    ...target,
    instanceId: "req",
    title: "作废会议预订",
    businessKind: VOID_REQUEST_KIND,
    status: "running"
  },
  availableActions: [],
  businessView: {
    target,
    plan,
    record
  }
};
const renderers: ApprovalPlugins["businessKinds"] = {
  meeting: {
    StartForm: () => null,
    DetailView: () => null,
    VoidOptions: ({ value, onChange }) => (
      <label>
        <input checked={Boolean(value.release)} type="checkbox" onChange={e => onChange({ release: e.target.checked })} />
        <span>释放预订</span>
      </label>
    )
  }
};

function setup(node: ReactNode, respond: (req: ApiRequest) => unknown, kinds = renderers, permission = true) {
  const writes: ApiRequest[] = [];
  const client = mockApprovalApi(req => {
    if (["start", "void_instance", "resubmit"].includes(req.action)) {
      writes.push(req);
      return null;
    }

    return respond(req);
  });
  render(<ApprovalProvider plugins={{ businessKinds: kinds }}>{node}</ApprovalProvider>, { apiClient: client, appContext: { hasPermission: () => permission } });
  return writes;
}

afterEach(() => vi.restoreAllMocks());

it("displays voided as a neutral final instance status", () => {
  render(<InstanceStatusTag status="voided" />);
  expect(screen.getByText("已作废")).toBeVisible();
});

it("refreshes the direct plan for options and requires a reason and a clear plan before writing", async () => {
  const user = userEvent.setup();
  const plans: ApiRequest[] = [];
  let views = 0;
  const writes = setup(<AdminInstanceDetailPanel instanceId="i" />, req => {
    if (req.action === "plan_void") {
      plans.push(req);
      return { policy: "direct", plan: { ...plan, blockers: (req.params?.options as { release?: boolean }).release ? [] : ["仍有签到记录"] } };
    }

    views++;
    return {
      ...base,
      instance: {
        ...target,
        tenantId: "t",
        voidPolicy: "direct"
      },
      availableActions: ["void"]
    };
  });
  expect(plans).toHaveLength(0);
  await user.click(await screen.findByRole("button", { name: /^作\s*废$/ }));
  const dialog = within(await screen.findByRole("dialog", { name: "作废审批单" }));
  expect(await dialog.findByText("仍有签到记录")).toBeVisible();
  expect(dialog.getByText("释放会议室")).toBeVisible();
  expect(dialog.getByText("通知参会人")).toBeVisible();
  const submit = dialog.getByRole("button", { name: "确认作废" });
  await user.type(dialog.getByLabelText("作废原因"), "变更");
  expect(submit).toBeDisabled();
  await user.clear(dialog.getByLabelText("作废原因"));
  await user.click(dialog.getByRole("checkbox", { name: "释放预订" }));
  await waitFor(() => expect(dialog.queryByText("仍有签到记录")).not.toBeInTheDocument());
  expect(submit).toBeDisabled();
  await user.type(dialog.getByLabelText("作废原因"), "会议取消");
  await user.click(submit);
  await waitFor(() => expect(writes).toHaveLength(1));
  await waitFor(() => expect(views).toBeGreaterThan(1));
  expect(plans.map(p => p.resource)).toEqual(["approval/admin", "approval/admin"]);
  expect(writes[0]).toMatchObject({
    resource: "approval/admin",
    action: "void_instance",
    params: {
      instanceId: "i",
      reason: "会议取消",
      attachments: [],
      options: { release: true }
    }
  });
});

it("requires the void permission even when the admin action is available", async () => {
  setup(<AdminInstanceDetailPanel instanceId="i" />, () => {
    return {
      ...base,
      instance: { ...target, tenantId: "t" },
      availableActions: ["void"]
    };
  }, renderers, false);
  await screen.findByText("预算会议");
  expect(screen.queryByRole("button", { name: /^作\s*废$/ })).not.toBeInTheDocument();
});

it("starts the configured void request through one ordinary approval start", async () => {
  const user = userEvent.setup();
  const reads: ApiRequest[] = [];
  const writes = setup(<InstanceDetailPanel instanceId="i" />, req => {
    reads.push(req);

    if (req.action === "get_start_form") {
      return {
        businessKind: VOID_REQUEST_KIND,
        flowCode: "void-flow",
        flowName: "会议作废审批",
        applicant: person,
        version: 1
      };
    }

    if (req.action === "plan_void") {
      return {
        policy: "approval",
        voidFlowCode: "void-flow",
        plan
      };
    }

    return { ...base, availableActions: ["request_void"] };
  });
  await user.click(await screen.findByRole("button", { name: "申请作废" }));
  const drawer = within(await screen.findByRole("dialog", { name: "申请作废" }));
  expect(await drawer.findByText("释放会议室")).toBeVisible();
  expect(drawer.getByText("预算会议")).toBeVisible();
  expect(drawer.getByRole("button", { name: "提交审批" })).toBeDisabled();
  await user.type(drawer.getByLabelText("作废原因"), "设备维修");
  await user.click(drawer.getByRole("button", { name: "提交审批" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(reads).toContainEqual(expect.objectContaining({
    resource: "approval/my",
    action: "plan_void",
    params: { instanceId: "i", options: {} }
  }));
  expect(writes[0]).toMatchObject({
    resource: "approval/instance",
    action: "start",
    params: {
      flowCode: "void-flow",
      formData: {
        targetInstanceId: "i",
        reason: "设备维修",
        attachments: [],
        options: {}
      }
    }
  });
});

it("replans a returned request with its new options before resubmission", async () => {
  const user = userEvent.setup();
  const writes = setup(<InstanceDetailPanel instanceId="req" />, req => {
    if (req.action === "plan_void") {
      return {
        policy: "approval",
        voidFlowCode: "void-flow",
        plan: { ...plan, blockers: (req.params?.options as { release?: boolean }).release ? [] : ["需释放预订"] }
      };
    }

    return {
      ...request,
      availableActions: ["resubmit"],
      instance: { ...request.instance, status: "returned" }
    };
  });
  expect(await screen.findByText("需释放预订")).toBeVisible();
  expect(screen.getByLabelText("作废原因")).toHaveValue("场地变更");
  await user.click(screen.getByRole("button", { name: "重新提交" }));
  expect(writes).toHaveLength(0);
  await user.click(screen.getByRole("checkbox", { name: "释放预订" }));
  await waitFor(() => expect(screen.queryByText("需释放预订")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "重新提交" }));
  await waitFor(() => expect(writes[0]).toMatchObject({ action: "resubmit", params: { instanceId: "req", formData: { targetInstanceId: "i", options: { release: true } } } }));
});

it("opens the linked returned request and shows its target, live plan and record", async () => {
  const user = userEvent.setup();
  setup(<InstanceDetailPanel instanceId="i" />, req => req.params?.instanceId === "req"
    ? request
    : {
        ...base,
        availableActions: [],
        voidRequest: {
          requestInstanceId: "req",
          requestInstanceNo: "作废-9",
          requestStatus: "returned",
          applicant: person,
          createdAt: "2026-11-18"
        }
      });
  expect(await screen.findByText("作废申请已退回修改")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "查看作废申请 作废-9" }));
  const drawer = within(await screen.findByRole("dialog", { name: "作废申请详情" }));
  expect(await drawer.findByText("作废原因：场地变更")).toBeVisible();
  expect(drawer.getByText("预算会议")).toBeVisible();
  expect(drawer.getByText("通知参会人")).toBeVisible();
});

it("shows the executed record on a voided target and allows the host to override the request renderer", async () => {
  setup(<InstanceDetailPanel instanceId="req" />, () => {
    return {
      ...request,
      voidRecord: {
        ...record,
        status: "voided",
        voidedAt: "2026-11-18",
        ...plan
      }
    };
  }, {
    [VOID_REQUEST_KIND]: { StartForm: () => null, DetailView: () => <span>业务专用申请面板</span> }
  });
  expect(await screen.findByText("业务专用申请面板")).toBeVisible();
  expect(screen.getByText("作废人 周宁")).toBeVisible();
  expect(screen.getByText("已撤销的事项")).toBeVisible();
  expect(screen.getByText("通知参会人")).toBeVisible();
});

it("omits restricted target and record fields while keeping the live plan visible", async () => {
  setup(<InstanceDetailPanel instanceId="req" />, () => {
    return {
      ...request,
      businessView: {
        target: {},
        plan,
        record: {
          ...record,
          instanceId: undefined,
          reason: undefined
        }
      }
    };
  });
  expect(await screen.findByText("释放会议室")).toBeVisible();
  expect(screen.getByText("通知参会人")).toBeVisible();
  expect(screen.queryByRole("button", { name: "查看原审批单" })).not.toBeInTheDocument();
  expect(screen.queryByText("预算会议")).not.toBeInTheDocument();
  expect(screen.queryByText(/^作废原因/)).not.toBeInTheDocument();
  expect(screen.queryByText(/undefined|^—$/)).not.toBeInTheDocument();
});

it("shows the target applicant without a hidden department and opens a visible target", async () => {
  const user = userEvent.setup();
  setup(<InstanceDetailPanel instanceId="req" />, req => req.params?.instanceId === "i" ? { ...base, availableActions: [] } : request);
  expect(await screen.findAllByText("申请人 周宁")).not.toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "查看原审批单" }));
  const drawer = within(await screen.findByRole("dialog", { name: "原审批单" }));
  expect(await drawer.findByText("预算会议")).toBeVisible();
});
