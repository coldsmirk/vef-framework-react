import type { AvailableFlow, BusinessKindDescriptor, Flow, StartForm } from "@vef-framework-react/approval";
import type { WindowStatus } from "@vef-framework-react/calendar";
import type { FormSchema } from "@vef-framework-react/form-editor";

import { VOID_REQUEST_KIND } from "@vef-framework-react/approval";

import { defineMock, MockBusinessError } from "../define-mock";
import { applyKeyword, paginate } from "../helpers/paginate";

export const expenseForm: FormSchema = {
  version: 2,
  id: "expense",
  presentations: {
    pc: {
      children: [
        {
          id: "subject",
          key: "subject",
          type: "textfield",
          label: "报销事项"
        },
        {
          id: "lines",
          key: "lines",
          type: "subform",
          variant: "stack",
          label: "费用明细",
          template: [
            {
              id: "item",
              key: "item",
              type: "textfield",
              label: "费用项目"
            },
            {
              id: "amount",
              key: "amount",
              type: "number",
              label: "金额（元）"
            }
          ]
        }
      ]
    }
  }
};

const catalog: BusinessKindDescriptor[] = [
  {
    kind: "office.meeting",
    label: "会议室预订",
    isVoidable: true,
    formFields: [
      {
        key: "subject",
        kind: "input",
        label: "会议主题",
        sortOrder: 0
      },
      {
        key: "room",
        kind: "input",
        label: "会议室",
        sortOrder: 1
      },
      {
        key: "agenda",
        kind: "textarea",
        label: "会议议程",
        sortOrder: 2
      }
    ]
  },
  {
    kind: VOID_REQUEST_KIND,
    label: "作废申请",
    isVoidable: false,
    formFields: [
      {
        key: "reason",
        kind: "textarea",
        label: "作废原因",
        sortOrder: 0
      }
    ]
  }
];

const category = {
  id: "office",
  name: "办公服务",
  code: "office",
  tenantId: "default",
  sortOrder: 1,
  isActive: true
};
const meetingFlow: Flow = {
  id: "meeting-flow",
  code: "meeting",
  name: "会议室预订",
  businessKind: "office.meeting",
  tenantId: "default",
  isShared: false,
  categoryId: category.id,
  adminUserIds: [],
  isAllInitiationAllowed: true,
  instanceTitleTemplate: "会议室预订申请",
  isActive: true,
  currentVersion: 1,
  businessBinding: {
    tableName: "meeting",
    keyColumns: ["id"],
    instanceIdColumn: "approval_id",
    statusColumn: "status",
    statusMapping: { approved: "reserved", voided: "cancelled" }
  },
  initiationWindow: { timezone: "Asia/Shanghai", windows: [{ times: [{ startsAt: "09:00:00", endsAt: "17:00:00" }] }] }
};
const flows: Flow[] = [
  meetingFlow,
  {
    ...meetingFlow,
    id: "request-flow",
    code: "meeting-void",
    name: "会议作废审批",
    businessKind: VOID_REQUEST_KIND,
    businessBinding: undefined,
    initiationWindow: undefined
  }
];
defineMock("approval/category", "find_tree", () => [category]);
defineMock<{ page?: number; pageSize?: number; keyword?: string; businessKind?: string }>("approval/flow", "find_flows", ({ params }) => {
  const filtered = flows.filter(flow => !params.businessKind || flow.businessKind === params.businessKind);
  return paginate(applyKeyword(filtered, params.keyword, ["name"]), { page: params.page, size: params.pageSize });
});
defineMock("approval/flow", "list_business_kinds", () => catalog);
defineMock("approval/flow", "list_kind_options", () => {
  const kinds = [
    {
      kind: "user",
      label: "指定人员",
      selection: "user"
    },
    {
      kind: "department",
      label: "指定部门",
      selection: "department"
    }
  ];
  return {
    assignees: kinds,
    ccs: kinds,
    initiators: kinds
  };
});
defineMock("approval/flow", "find_initiators", () => []);
defineMock("approval/flow", "find_versions", () => [
  {
    id: "v1",
    version: 1,
    status: "published",
    storageMode: "json",
    createdAt: "2026-11-18 09:00:00"
  }
]);
defineMock("approval/flow", "get_graph", () => {
  return { version: { id: "v1", storageMode: "json" } };
});

const minute = 60_000;
const settlementEnd = Date.now() + 20 * minute;
const available = [
  ["expenses", "日常费用报销", "随时提交办公支出和交通费用。"],
  ["closing", "本期差旅结算", "本轮结算即将截止。"],
  ["short", "临时采购补录", "演示时段每半分钟开放 20 秒，可在填单时观察截止提示。"],
  ["next", "下月用车申请", "下一轮预约开放后可提交。"],
  ["closed", "年度专项经费", "本年度申报已结束。"],
  ["unregistered", "资产调拨", "由资产管理系统提供业务表单。"]
] as const;

function windowStatus(code: string): WindowStatus | undefined {
  if (code === "expenses") {
    return { open: true, current: {} };
  }

  const now = Date.now();

  if (code === "closing") {
    return now < settlementEnd ? { open: true, current: { endsAtUnixMs: settlementEnd } } : { open: false };
  }

  if (code === "short") {
    const cycle = now - now % 30_000;
    return now < cycle + 20_000 ? { open: true, current: { startsAtUnixMs: cycle, endsAtUnixMs: cycle + 20_000 } } : { open: false, next: { startsAtUnixMs: cycle + 30_000 } };
  }

  if (code === "next") {
    return { open: false, next: { startsAtUnixMs: now + 24 * 60 * minute } };
  }

  if (code === "closed") {
    return { open: false };
  }
}

function availableFlows(): AvailableFlow[] {
  return available.map(([code, name, description]) => {
    return {
      flowId: code,
      flowCode: code,
      flowName: name,
      description,
      categoryId: category.id,
      categoryName: category.name,
      businessKind: code === "unregistered" ? "assets.transfer" : undefined,
      initiationWindow: windowStatus(code)
    };
  });
}

defineMock<{ keyword?: string; page?: number; pageSize?: number }>("approval/my", "find_available_flows", ({ params }) => paginate(applyKeyword(availableFlows(), params.keyword, ["flowName"]), { page: params.page, size: params.pageSize }));

export function officeStartForm(code: string): StartForm | undefined {
  const flow = availableFlows().find(item => item.flowCode === code);

  if (!flow) {
    return;
  }

  if (flow.initiationWindow?.open === false) {
    throw new MockBusinessError(40_027, "本次发起时段已截止");
  }

  return {
    ...flow,
    version: 1,
    versionId: "v1",
    applicant: { id: "u_4", name: "周宁" },
    formSchema: flow.businessKind ? undefined : expenseForm
  };
}
