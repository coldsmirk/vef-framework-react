import type { FlowDefinition } from "@vef-framework-react/approval-flow-editor";
import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalFlowEditor } from "@vef-framework-react/approval-flow-editor";
import { Page } from "@vef-framework-react/components";
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
      data: { name: "部门审批" }
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

const plugins = {
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
