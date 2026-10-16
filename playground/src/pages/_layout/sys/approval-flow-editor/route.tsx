import type { EditorPlugins, FlowDefinition, PickerProps } from "@vef-framework-react/approval-flow-editor";
import type { FC, ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalFlowEditor } from "@vef-framework-react/approval-flow-editor";
import { Page, Select } from "@vef-framework-react/components";
import { useCallback } from "react";

export const Route = createFileRoute("/_layout/sys/approval-flow-editor")({
  component: RouteComponent
});

const initialValue: FlowDefinition = {
  nodes: [
    {
      id: "start_1",
      kind: "start",
      position: { x: 40, y: 240 },
      data: { name: "开始" }
    },
    {
      id: "approval_1",
      kind: "approval",
      position: { x: 520, y: 120 },
      data: {
        name: "部门审批",
        assignees: [
          {
            kind: "user",
            ids: ["zhang"],
            tenantId: "hospital-a",
            sortOrder: 1
          }
        ]
      }
    },
    {
      id: "approval_2",
      kind: "approval",
      position: { x: 760, y: 120 },
      data: { name: "总监审批" }
    },
    {
      id: "condition_1",
      kind: "condition",
      position: { x: 280, y: 240 },
      data: {
        name: "金额判断",
        branches: [
          {
            id: "gt_1000",
            label: "大于1000",
            conditionGroups: [
              {
                conditions: [
                  {
                    kind: "field",
                    subject: "amount",
                    operator: "gt",
                    value: 1000,
                    expression: ""
                  }
                ]
              }
            ],
            priority: 1
          },
          {
            id: "default",
            label: "默认",
            isDefault: true,
            priority: 99
          }
        ]
      }
    },
    {
      id: "handle_1",
      kind: "handle",
      position: { x: 520, y: 360 },
      data: { name: "财务处理" }
    },
    {
      id: "end_1",
      kind: "end",
      position: { x: 1000, y: 240 },
      data: { name: "结束" }
    }
  ],
  edges: [
    {
      id: "e1",
      source: "start_1",
      target: "condition_1"
    },
    {
      id: "e2",
      source: "condition_1",
      target: "approval_1",
      sourceHandle: "gt_1000"
    },
    {
      id: "e3",
      source: "condition_1",
      target: "handle_1",
      sourceHandle: "default"
    },
    {
      id: "e4",
      source: "approval_1",
      target: "approval_2"
    },
    {
      id: "e5",
      source: "approval_2",
      target: "end_1"
    },
    {
      id: "e6",
      source: "handle_1",
      target: "end_1"
    }
  ]
};

/**
 * The demo is a shared flow: it routes work to people of other tenants, so a
 * rule that picks users or departments asks for the tenant first and the
 * pickers below list only that tenant's people.
 */
const TENANTS = [
  { value: "hospital-a", label: "第一医院" },
  { value: "hospital-b", label: "第二医院" }
];

const USERS_BY_TENANT: Record<string, Array<{ label: string; value: string }>> = {
  "hospital-a": [{ label: "张三", value: "zhang" }, { label: "王五", value: "wang" }],
  "hospital-b": [{ label: "李四", value: "li" }, { label: "赵六", value: "zhao" }]
};

const DEPARTMENTS_BY_TENANT: Record<string, Array<{ label: string; value: string }>> = {
  "hospital-a": [{ label: "内科", value: "a-internal" }, { label: "外科", value: "a-surgery" }],
  "hospital-b": [{ label: "检验科", value: "b-lab" }, { label: "药剂科", value: "b-pharmacy" }]
};

function createTenantPicker(optionsByTenant: Record<string, Array<{ label: string; value: string }>>): FC<PickerProps> {
  const TenantPicker: FC<PickerProps> = ({
    disabled,
    tenantId,
    value,
    onChange
  }) => (
    <Select
      disabled={disabled}
      mode="multiple"
      options={tenantId ? optionsByTenant[tenantId] ?? [] : []}
      placeholder="选择"
      style={{ width: "100%" }}
      value={value}
      onChange={onChange}
    />
  );

  return TenantPicker;
}

const plugins: EditorPlugins = {
  shared: true,
  tenants: TENANTS,
  pickers: {
    user: createTenantPicker(USERS_BY_TENANT),
    department: createTenantPicker(DEPARTMENTS_BY_TENANT)
  },
  // Host-declared globals resolved from the instance's server-side snapshot
  // (`Instance.Globals`) — available to visual conditions and expressions
  // alongside the built-in applicant subjects and the form fields below.
  globalSubjects: [
    {
      key: "applicantLevel",
      kind: "number" as const,
      label: "发起人职级"
    },
    {
      key: "applicantDepartmentName",
      kind: "select" as const,
      label: "发起人部门",
      options: [
        { label: "研发部", value: "研发部" },
        { label: "销售部", value: "销售部" },
        { label: "财务部", value: "财务部" }
      ]
    }
  ],
  formFields: [
    {
      key: "amount",
      kind: "number" as const,
      label: "金额"
    },
    {
      key: "reason",
      kind: "textarea" as const,
      label: "申请原因"
    },
    {
      key: "department",
      kind: "select" as const,
      label: "部门",
      options: [
        { label: "研发部", value: "dev" },
        { label: "销售部", value: "sales" },
        { label: "财务部", value: "finance" }
      ]
    },
    {
      key: "attachment",
      kind: "upload" as const,
      label: "附件"
    }
  ]
};

function RouteComponent(): ReactNode {
  const handleChange = useCallback((def: FlowDefinition) => {
    console.log("Flow changed:", def);
  }, []);

  return (
    <Page>
      <div style={{ width: "100%", height: "100%" }}>
        <ApprovalFlowEditor
          plugins={plugins}
          value={initialValue}
          onChange={handleChange}
        />
      </div>
    </Page>
  );
}
