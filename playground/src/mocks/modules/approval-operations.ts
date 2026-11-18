import type { AdminTask, ApprovalMetrics, CompletedTask, HandoverReport, MyInstanceDetail, PendingTask, ReassignTaskParams } from "@vef-framework-react/approval";

import { defineMock, MockBusinessError } from "../define-mock";
import { applyKeyword, paginate } from "../helpers/paginate";
import { expenseForm } from "./approval-flows";

const former = { id: "u_1", name: "张三" };
const reviewer = { id: "u_2", name: "李四" };
const unassigned = { id: "u_3", name: "王五" };
const applicant = { id: "u_4", name: "周宁" };

interface Search { page?: number; pageSize?: number; keyword?: string; status?: string }

export function setupApprovalOperations(instances: Map<string, MyInstanceDetail>, meeting: (id: string, returned?: boolean) => MyInstanceDetail) {
  const reviewNode = "财务复核";
  const detail = meeting("expense-review");
  Object.assign(detail.instance, {
    flowId: "expenses",
    flowCode: "expenses",
    flowName: "日常费用报销",
    title: "采购样品差旅报销",
    instanceNo: "BX-2026-021",
    businessKind: undefined,
    applicant,
    currentNodeName: reviewNode,
    formData: { subject: "采购样品差旅报销", lines: [{ item: "高铁车票", amount: 385 }, { item: "市内交通", amount: 68 }] }
  });
  detail.formSchema = expenseForm;
  detail.fieldPermissions = { subject: "editable", lines: "editable" };
  detail.businessView = undefined;
  detail.availableActions = ["approve", "reject"];
  const visit = detail.timeline[1]!;
  visit.name = reviewNode;
  visit.participants![0]!.predecessor = former;
  visit.participants![0]!.handoverReason = "离职";
  detail.flowGraph.nodes[1]!.data.name = reviewNode;
  const note = detail.annotations![0]!;
  detail.annotations = [
    {
      ...note,
      nodeName: reviewNode,
      content: "请附上采购申请单。",
      anchor: { field: "subject" }
    },
    {
      ...note,
      id: "line-note",
      nodeName: reviewNode,
      content: "第一笔行程需补充乘车人。",
      anchor: { field: "lines", row: 0 }
    },
    {
      ...note,
      id: "column-note",
      nodeName: reviewNode,
      content: "请核对各项费用的报销金额。",
      anchor: { field: "lines", column: "amount" }
    },
    {
      ...note,
      id: "cell-note",
      nodeName: reviewNode,
      content: "请核对第二笔金额和发票。",
      anchor: {
        field: "lines",
        row: 1,
        column: "amount"
      }
    }
  ];
  instances.set(detail.instance.instanceId, detail);
  const waiting = meeting("expense-returned", true);
  Object.assign(waiting.instance, {
    ...detail.instance,
    instanceId: "expense-returned",
    instanceNo: "BX-2026-016",
    title: "",
    applicant: former,
    status: "returned",
    currentNodeName: "申请人补充材料"
  });
  waiting.formSchema = expenseForm;
  waiting.annotations = [];
  instances.set(waiting.instance.instanceId, waiting);
  const missing = meeting("asset-returned", true);
  Object.assign(missing.instance, {
    title: "打印设备调拨",
    instanceNo: "ZC-2026-008",
    flowName: "资产调拨",
    businessKind: "assets.transfer"
  });
  missing.annotations = [];
  instances.set(missing.instance.instanceId, missing);

  const tasks: AdminTask[] = [
    {
      taskId: detail.myTask!.taskId,
      instanceId: detail.instance.instanceId,
      instanceTitle: detail.instance.title,
      instanceNo: detail.instance.instanceNo,
      flowName: detail.instance.flowName,
      nodeName: reviewNode,
      assignee: reviewer,
      predecessor: former,
      status: "pending",
      createdAt: detail.instance.createdAt
    },
    {
      taskId: "finished-finance",
      instanceId: "meeting-voided",
      instanceTitle: "会务协调会",
      instanceNo: instances.get("meeting-voided")!.instance.instanceNo,
      flowName: "会议室预订",
      nodeName: "会务审核",
      assignee: reviewer,
      predecessor: former,
      status: "approved",
      createdAt: detail.instance.createdAt,
      finishedAt: "2026-11-18 11:30:00"
    }
  ];

  function taskRow(task: AdminTask) {
    const { instance } = instances.get(task.instanceId)!;
    return {
      ...task,
      applicant: instance.applicant,
      instanceNo: instance.instanceNo,
      isTimeout: false
    };
  }

  defineMock<Search>("approval/my", "find_pending_tasks", ({ params }) => {
    const pending: PendingTask[] = tasks.filter(task => task.status === "pending").map(task => taskRow(task));
    return paginate(applyKeyword(pending, params.keyword, ["instanceTitle", "instanceNo"]), { page: params.page, size: params.pageSize });
  });
  defineMock<Search>("approval/my", "find_completed_tasks", ({ params }) => {
    const completed: CompletedTask[] = tasks.filter(task => task.status !== "pending").map(task => taskRow(task));
    return paginate(applyKeyword(completed, params.keyword, ["instanceTitle", "instanceNo"]), { page: params.page, size: params.pageSize });
  });
  defineMock<Search>("approval/admin", "find_tasks", ({ params }) => paginate(tasks.filter(task => !params.status || task.status === params.status), { page: params.page, size: params.pageSize }));
  defineMock("approval/my", "get_pending_counts", () => {
    return { pendingTaskCount: tasks.filter(task => task.status === "pending").length, unreadCcCount: 0 };
  });
  defineMock("approval/my", "find_cc_records", () => {
    return { items: [], total: 0 };
  });
  defineMock("approval/admin", "find_business_projections", () => {
    return { items: [], total: 0 };
  });

  for (const [resource, action] of [["approval/my", "find_initiated"], ["approval/admin", "find_instances"]] as const) {
    defineMock<Search>(resource, action, ({ params }) => {
      const rows = instances.values().map(({ instance }) => {
        return { ...instance, tenantId: "default" };
      }).toArray();
      const filtered = applyKeyword(rows.filter(row => !params.status || row.status === params.status), params.keyword, ["title", "instanceNo"]);
      return paginate(filtered, { page: params.page, size: params.pageSize });
    });
  }

  defineMock("approval/admin", "get_metrics", (): ApprovalMetrics => {
    const instanceCounts: ApprovalMetrics["instanceCounts"] = {};

    for (const { instance } of instances.values()) {
      instanceCounts[instance.status] = (instanceCounts[instance.status] ?? 0) + 1;
    }

    return {
      tenantId: "default",
      capturedAt: new Date().toISOString(),
      instanceCounts,
      taskCounts: { pending: 1, approved: 1 },
      avgCompletionSeconds: 7200,
      timeoutTaskCount: 0,
      pendingBindingFailures: 0,
      businessProjectionCounts: {},
      pendingBusinessProjections: 0
    };
  });
  defineMock<{ userIds: string[] }>("approval/admin", "apply_handovers", ({ params }): HandoverReport => {
    return {
      transferred: params.userIds.includes(former.id)
        ? [
            {
              taskId: tasks[0]!.taskId,
              instanceId: detail.instance.instanceId,
              predecessor: former,
              successor: reviewer
            }
          ]
        : [],
      unassigned: params.userIds.includes(unassigned.id)
        ? [
            {
              ccRecordId: "cc-01",
              instanceId: "meeting-review",
              predecessor: unassigned
            }
          ]
        : [],
      awaitingApplicant: params.userIds.includes(former.id) ? [waiting.instance.instanceId] : []
    };
  });
  defineMock<ReassignTaskParams>("approval/admin", "reassign_task", ({ params }) => {
    if (params.newAssigneeId === former.id) {
      throw new MockBusinessError(40_028, "张三已离职，不能接收待办，请重新选人。");
    }

    const task = tasks.find(item => item.taskId === params.taskId);

    if (task) {
      task.assignee = params.newAssigneeId === reviewer.id ? reviewer : unassigned;
    }

    return null;
  });
}
