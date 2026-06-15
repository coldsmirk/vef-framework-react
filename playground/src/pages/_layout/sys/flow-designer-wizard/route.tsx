import type { ReactNode } from "react";

import type { FlowDesignerWizardInitialValue } from "./components/wizard";
import type { FlowDesignPayload } from "./types";

import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@vef-framework-react/components";

import { mockPickers } from "./components/mock-pickers";
import { FlowDesignerWizard } from "./components/wizard";

export const Route = createFileRoute("/_layout/sys/flow-designer-wizard")({
  component: RouteComponent
});

const plugins = { pickers: mockPickers };

const initialValue: FlowDesignerWizardInitialValue = {
  basic: {
    code: "leave_request",
    name: "请假申请",
    instanceTitleTemplate: "{applicant} 的请假申请"
  },
  initiators: [{ kind: "user", ids: ["u_1"] }],
  storageMode: "json",
  flowDefinition: {
    nodes: [
      {
        id: "start_1",
        kind: "start",
        position: { x: 40, y: 160 },
        data: { name: "开始" }
      },
      {
        id: "approval_1",
        kind: "approval",
        position: { x: 340, y: 160 },
        data: { name: "部门审批" }
      },
      {
        id: "end_1",
        kind: "end",
        position: { x: 640, y: 160 },
        data: { name: "结束" }
      }
    ],
    edges: [
      {
        id: "e1",
        source: "start_1",
        target: "approval_1"
      },
      {
        id: "e2",
        source: "approval_1",
        target: "end_1"
      }
    ]
  }
};

function handleComplete(payload: FlowDesignPayload): void {
  // The wizard is purely controlled: a real host would now run
  // CreateFlowCmd -> DeployFlowCmd -> PublishVersionCmd. The prototype just logs.
  console.log("Flow design completed:", payload);
}

function RouteComponent(): ReactNode {
  return (
    <Page>
      <div style={{
        width: "100%",
        height: "100%",
        minHeight: 0
      }}
      >
        <FlowDesignerWizard initialValue={initialValue} plugins={plugins} onComplete={handleComplete} />
      </div>
    </Page>
  );
}
