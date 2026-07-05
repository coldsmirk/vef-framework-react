import type { EvaluationContext, LinkageContextSource } from "@vef-framework-react/form-editor";
import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Page, showSuccessMessage } from "@vef-framework-react/components";
import { FormEditor } from "@vef-framework-react/form-editor";

import { DEMO_SCHEMA } from "./demo-schema";

export const Route = createFileRoute("/_layout/sys/form-editor")({
  component: RouteComponent
});

// Host-injected runtime context, as an approval host would supply for the
// applicant. Expressions and `$`-rooted visual conditions read it via
// `$user.*`; the demo schema shows a finance-only field driven by it.
const EVALUATION_CONTEXT: EvaluationContext = {
  user: {
    id: "user-admin",
    name: "演示账号",
    departmentId: "dept-finance",
    departmentName: "财务部"
  }
};

// Design-time pick list: these paths appear as a "全局上下文" group in the
// visual condition builder's source dropdown.
const CONTEXT_SOURCES: LinkageContextSource[] = [
  { key: "$user.name", label: "发起人姓名" },
  { key: "$user.departmentId", label: "发起人部门 ID" },
  { key: "$user.departmentName", label: "发起人部门" }
];

function RouteComponent(): ReactNode {
  return (
    <Page>
      <div style={{
        width: "100%",
        height: "100%",
        minHeight: 0
      }}
      >
        <FormEditor
          contextSources={CONTEXT_SOURCES}
          evaluationContext={EVALUATION_CONTEXT}
          initialSchema={DEMO_SCHEMA}
          onPublish={() => showSuccessMessage("Schema 已发布（演示）")}
        />
      </div>
    </Page>
  );
}
