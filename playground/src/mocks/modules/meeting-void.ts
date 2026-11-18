import type { MyInstanceDetail, PlanVoidParams, ProcessTaskAction, VoidInstanceParams, VoidOptions, VoidPlan, VoidRecord, VoidRequestBusinessView } from "@vef-framework-react/approval";

import { VOID_REQUEST_KIND } from "@vef-framework-react/approval";

import { defineMock, MockBusinessError } from "../define-mock";

const flowCode = "meeting-void";
const time = "2026-11-18 15:30:00";

function plan(id: string, options?: VoidOptions): VoidPlan {
  return {
    blockers: id === "meeting-blocked" ? ["会议已开始签到，请先结束签到。"] : [],
    reversals: options?.releaseRoom ? ["取消会议安排", "释放会议室时段"] : ["取消会议安排"],
    followUps: ["通知已受邀的参会人"]
  };
}

export function setupMeetingVoids(instances: Map<string, MyInstanceDetail>, meeting: (id: string) => MyInstanceDetail) {
  function get(id: string) {
    const result = instances.get(id);

    if (!result) {
      throw new MockBusinessError(404, "演示审批单不存在");
    }

    return result;
  }

  function execute(target: MyInstanceDetail, data: VoidRecord) {
    const preview = plan(target.instance.instanceId, data.options);
    data.status = "voided";
    data.voidedAt = time;
    data.reversals = preview.reversals;
    data.followUps = preview.followUps;
    target.voidRecord = data;
    target.voidRequest = undefined;
    target.instance.status = "voided";
    target.availableActions = [];
    target.timeline.push({
      kind: "void",
      startedAt: time,
      activities: [
        {
          action: "void",
          operator: data.operator,
          opinion: data.reason,
          createdAt: time
        }
      ]
    });
  }

  function makeRecord(target: MyInstanceDetail, reason: string, options?: VoidOptions, attachments?: string[]): VoidRecord {
    return {
      id: crypto.randomUUID(),
      tenantId: "demo",
      instanceId: target.instance.instanceId,
      status: "requested",
      operator: target.instance.applicant,
      reason,
      options,
      attachments,
      reversals: [],
      followUps: []
    };
  }

  function startRequest(target: MyInstanceDetail, record: VoidRecord, returned = false) {
    const id = `${target.instance.instanceId}-request`;
    record.requestInstanceId = id;
    const request = meeting(id);
    Object.assign(request.instance, {
      instanceNo: `ZF-${target.instance.instanceNo}`,
      flowName: "会议作废审批",
      flowCode,
      businessKind: VOID_REQUEST_KIND,
      title: `作废申请 · ${target.instance.title}`,
      status: returned ? "returned" : "running"
    });
    request.annotations = [];
    request.businessView = {
      target: target.instance,
      plan: plan(target.instance.instanceId, record.options),
      record
    } satisfies VoidRequestBusinessView;

    if (returned) {
      request.myTask = undefined;
      request.availableActions = ["resubmit"];
    }

    target.availableActions = [];
    target.voidRequest = {
      requestInstanceId: id,
      requestInstanceNo: request.instance.instanceNo,
      applicant: record.operator,
      requestStatus: returned ? "returned" : "running",
      createdAt: time
    };
    instances.set(id, request);
    return { instanceId: id };
  }

  function seedVoidState(id: string, target: MyInstanceDetail) {
    if (id === "meeting-voided") {
      execute(target, makeRecord(target, "场地检修，会议延期", { releaseRoom: true }));

      return;
    }

    if (id === "meeting-delivery" || id === "meeting-premises") {
      const record = makeRecord(target, "会场安排已调整", { releaseRoom: true });
      const request = get(startRequest(target, record).instanceId);
      const approved = id === "meeting-delivery";
      request.instance.status = approved ? "approved" : "rejected";
      request.instance.finishedAt = time;
      request.instance.currentNodeName = undefined;
      request.myTask = undefined;
      request.availableActions = [];
      const review = request.timeline.at(-1)!;
      review.finishedAt = time;
      review.status = approved ? "passed" : "rejected";
      review.participants![0]!.status = request.instance.status;
      request.flowGraph.nodes[1]!.data.status = review.status;

      if (approved) {
        execute(target, record);
      } else {
        record.status = "dismissed";
        target.voidRequest = undefined;
        target.availableActions = ["request_void"];
      }

      return;
    }

    if (id === "meeting-pending" || id === "meeting-revision") {
      startRequest(target, makeRecord(target, "会务安排调整"), id === "meeting-revision");
    }
  }

  const samples = [
    ["meeting-direct", "年度预算讨论会"],
    ["meeting-blocked", "正在签到的培训会"],
    ["meeting-requestable", "设备采购讨论会"],
    ["meeting-pending", "季度采购复核会"],
    ["meeting-voided", "会务协调会"],
    ["meeting-revision", "项目评审会"],
    ["meeting-delivery", "设备交付协调会"],
    ["meeting-premises", "园区用房协调会"]
  ] as const;

  for (const [index, [id, title]] of samples.entries()) {
    const target = meeting(id);
    const policy = id === "meeting-direct" || id === "meeting-blocked" || id === "meeting-voided" ? "direct" : "approval";
    Object.assign(target.instance, {
      title,
      instanceNo: `HY-2026-0${30 + index}`,
      status: "approved",
      currentNodeName: undefined,
      finishedAt: time,
      voidPolicy: policy,
      voidFlowCode: policy === "approval" ? flowCode : undefined
    });
    target.businessView = { ...target.businessView as object, subject: title };
    target.myTask = undefined;
    target.annotations = [];
    target.availableActions = policy === "approval" ? ["request_void"] : [];
    const visit = target.timeline.at(-1);

    if (visit) {
      visit.status = "passed";

      const participants = visit.participants ?? [];

      for (const person of participants) {
        person.status = "approved";
      }
    }

    const node = target.flowGraph.nodes.find(item => item.nodeId === "review");

    if (node) {
      node.data.status = "passed";
    }

    instances.set(id, target);

    seedVoidState(id, target);
  }

  defineMock<{ instanceId: string }>("approval/admin", "get_instance_detail", ({ params }) => {
    const detail = get(params.instanceId);
    return {
      ...detail,
      instance: {
        ...detail.instance,
        tenantId: "demo",
        flowVersionId: "v1"
      },
      availableActions: detail.instance.status === "approved" && detail.instance.voidPolicy === "direct" ? ["void"] : []
    };
  });
  defineMock("approval/admin", "find_action_logs", () => {
    return { items: [], total: 0 };
  });
  defineMock<PlanVoidParams>("approval/admin", "plan_void", ({ params }) => {
    return { policy: "direct", plan: plan(params.instanceId, params.options) };
  });
  defineMock<PlanVoidParams>("approval/my", "plan_void", ({ params }) => {
    return {
      policy: "approval",
      voidFlowCode: flowCode,
      plan: plan(params.instanceId, params.options)
    };
  });
  defineMock<VoidInstanceParams>("approval/admin", "void_instance", ({ params }) => {
    const target = get(params.instanceId);

    if (plan(params.instanceId, params.options).blockers.length > 0) {
      throw new MockBusinessError(40_038, "会议已开始签到，请先结束签到。");
    }

    execute(target, makeRecord(target, params.reason, params.options, params.attachments));
    return null;
  });
  return {
    flowCode,
    startForm: {
      businessKind: VOID_REQUEST_KIND,
      flowCode,
      flowId: "meeting-void-flow",
      flowName: "会议作废审批",
      version: 1,
      versionId: "v1",
      applicant: get("meeting-requestable").instance.applicant
    },
    start(data: Record<string, unknown> = {}) {
      const target = get(String(data.targetInstanceId));
      return startRequest(target, makeRecord(target, String(data.reason), data.options as VoidOptions, data.attachments as string[]));
    },
    decide(request: MyInstanceDetail, action: ProcessTaskAction) {
      const { record } = request.businessView as VoidRequestBusinessView;
      const target = get(record.instanceId!);

      if (action === "approve") {
        execute(target, record);
      } else {
        record.status = "dismissed";
        target.voidRequest = undefined;
        target.availableActions = ["request_void"];
      }
    },
    resubmit(request: MyInstanceDetail, data?: Record<string, unknown>) {
      const view = request.businessView as VoidRequestBusinessView;
      Object.assign(view.record, {
        reason: data?.reason,
        attachments: data?.attachments,
        options: data?.options
      });
      view.plan = plan(view.target.instanceId!, view.record.options);
      const pending = get(view.target.instanceId!).voidRequest;

      if (pending) {
        pending.requestStatus = "running";
      }
    }
  };
}
