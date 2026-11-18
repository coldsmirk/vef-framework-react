import type { AnnotationView, MyInstanceDetail, ProcessTaskParams, ResubmitInstanceParams, SaveAnnotationParams, StartInstanceParams } from "@vef-framework-react/approval";

import { defineMock, MockBusinessError } from "../define-mock";

const applicant = { id: "u_1", name: "张三" };
const reviewer = { id: "u_2", name: "李四" };
const kind = "office.meeting";
const start = {
  flowId: "meeting-flow",
  flowCode: "meeting",
  flowName: "会议室预订",
  versionId: "v1",
  version: 1,
  applicant,
  businessKind: kind
};
const date = "2026-11-18 09:00:00";

function meeting(id: string, returned = false): MyInstanceDetail {
  const taskId = `${id}-task`;
  const root: AnnotationView = {
    id: `${id}-agenda`,
    instanceId: id,
    nodeId: "review",
    nodeName: "会务审核",
    visitId: "review-1",
    taskId,
    status: "published",
    audience: { scope: "participants" },
    author: reviewer,
    content: "请补上会议议程。",
    publishedAt: date
  };
  const budget = {
    ...root,
    id: `${id}-budget`,
    content: "能否缩短讨论时间？"
  };
  return {
    instance: {
      instanceId: id,
      instanceNo: returned ? "HY-2026-018" : "HY-2026-019",
      status: returned ? "returned" : "running",
      flowId: start.flowId,
      flowName: start.flowName,
      flowCode: start.flowCode,
      title: "季度预算讨论会",
      currentNodeName: returned ? "申请人修改" : "会务审核",
      createdAt: date,
      applicant,
      businessKind: kind
    },
    businessView: {
      subject: "季度预算讨论会",
      room: "三楼 · 松林会议室",
      agenda: "讨论下一季度预算及人员安排。",
      writes: 0
    },
    myTask: returned
      ? undefined
      : {
          taskId,
          nodeId: "review",
          isOpinionRequired: false
        },
    availableActions: returned ? ["resubmit"] : ["approve", "reject"],
    flowGraph: {
      nodes: [
        {
          id: "start",
          nodeId: "start",
          kind: "start",
          data: { name: "发起申请", status: "passed" },
          position: { x: 0, y: 0 }
        },
        {
          id: "review",
          nodeId: "review",
          kind: "approval",
          data: { name: "会务审核", status: returned ? "returned" : "active" },
          position: { x: 220, y: 0 }
        }
      ],
      edges: [
        {
          id: "step",
          source: "start",
          target: "review"
        }
      ]
    },
    timeline: [
      {
        kind: "start",
        visitId: "start",
        name: "发起申请",
        startedAt: date
      },
      {
        kind: "approval",
        visitId: "review-1",
        name: "会务审核",
        startedAt: date,
        participants: [
          {
            taskId,
            user: reviewer,
            status: returned ? "rolled_back" : "pending"
          }
        ]
      }
    ],
    annotations: [
      root,
      budget,
      {
        ...root,
        id: `${id}-addressed`,
        parentId: root.id,
        author: applicant,
        resolution: "addressed",
        content: "已补充议程。",
        taskId: undefined,
        visitId: undefined
      },
      {
        ...budget,
        id: `${id}-declined`,
        parentId: budget.id,
        author: applicant,
        resolution: "declined",
        content: "各部门都需要汇报，保留原定时长。",
        taskId: undefined,
        visitId: undefined
      },
      ...returned
        ? []
        : [
            {
              ...root,
              id: `${id}-draft`,
              content: "请确认参会人数。",
              status: "draft" as const
            },
            {
              ...root,
              id: `${id}-discarded`,
              content: "旧草稿：会场是否需要投影？",
              status: "discarded" as const
            }
          ]
    ]
  };
}

const instances = new Map(["meeting-review", "meeting-returned"].map(id => [id, meeting(id, id === "meeting-returned")]));

function get(id: string) {
  const detail = instances.get(id);

  if (!detail) {
    throw new MockBusinessError(404, "演示审批单不存在");
  }

  return detail;
}

function record(detail: MyInstanceDetail, data?: Record<string, unknown>) {
  const previous = detail.businessView as { writes: number };
  detail.businessView = {
    ...previous,
    ...data,
    writes: previous.writes + 1
  };
  detail.instance.title = String(data?.subject ?? detail.instance.title);
}

defineMock("approval/my", "get_start_form", () => start);
defineMock<{ instanceId: string }>("approval/my", "get_instance_detail", ({ params }) => get(params.instanceId));
defineMock<StartInstanceParams>("approval/instance", "start", ({ params }) => {
  const detail = meeting("meeting-new");
  detail.annotations = [];
  detail.instance.instanceNo = "HY-2026-020";
  record(detail, params.formData);
  instances.set("meeting-new", detail);
  return { instanceId: "meeting-new" };
});
defineMock<ProcessTaskParams>("approval/instance", "process_task", ({ params }) => {
  const detail = instances.values().find(item => item.myTask?.taskId === params.taskId);

  if (!detail) {
    throw new MockBusinessError(404, "演示待办不存在");
  }

  record(detail, params.formData);
  detail.instance.status = params.action === "reject" ? "rejected" : "approved";
  detail.instance.currentNodeName = undefined;
  detail.availableActions = [];
  detail.myTask = undefined;

  const notes = detail.annotations ?? [];

  for (const item of notes) {
    if (item.taskId === params.taskId && item.status === "draft") {
      item.status = "published";
    }
  }

  const participant = detail.timeline.at(-1)?.participants?.[0];

  if (participant) {
    participant.status = detail.instance.status;
  }
});
defineMock<ResubmitInstanceParams>("approval/instance", "resubmit", ({ params }) => {
  const detail = get(params.instanceId);
  record(detail, params.formData);
  detail.instance.status = "running";
  detail.instance.currentNodeName = "会务审核";
  detail.availableActions = [];

  const notes = detail.annotations ?? [];

  for (const item of notes) {
    if (item.parentId && item.status === "draft") {
      item.status = "published";
    }
  }
});
defineMock<SaveAnnotationParams>("approval/instance", "save_annotation", ({ params }) => {
  const response = "parentId" in params;
  const detail = instances.values().find(item => response ? item.annotations?.some(a => a.id === params.parentId) : item.myTask?.taskId === params.taskId);

  if (!detail) {
    throw new MockBusinessError(40_035, "当前无法写入批注");
  }

  const parent = response ? detail.annotations?.find(a => a.id === params.parentId) : undefined;
  const annotation: AnnotationView = {
    ...params,
    id: params.id ?? crypto.randomUUID(),
    author: response ? applicant : reviewer,
    status: "draft",
    instanceId: detail.instance.instanceId,
    nodeId: response ? "start" : "review",
    nodeName: response ? "发起申请" : "会务审核",
    visitId: response ? undefined : "review-1",
    audience: (response ? parent?.audience : params.audience) ?? { scope: "participants" },
    anchor: response ? parent?.anchor : params.anchor
  };
  detail.annotations = [...(detail.annotations ?? []).filter(a => a.id !== annotation.id), annotation];
  return annotation;
});
defineMock<{ id: string }>("approval/instance", "delete_annotation", ({ params }) => {
  for (const detail of instances.values()) {
    detail.annotations = detail.annotations?.filter(item => item.id !== params.id);
  }
});
