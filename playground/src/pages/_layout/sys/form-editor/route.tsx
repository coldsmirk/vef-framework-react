import type { EvaluationContext, LinkageContextSource } from "@vef-framework-react/form-editor";
import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Page, showSuccessMessage } from "@vef-framework-react/components";
import { FormEditor } from "@vef-framework-react/form-editor";
import { FORM_DATA_SOURCE_APIS, formDataSourceResolver } from "~apis";

import { DEMO_SCHEMA } from "./demo-schema";

export const Route = createFileRoute("/_layout/sys/form-editor")({
  component: RouteComponent
});

// Host-injected runtime context, as an approval host supplies it: the
// initiator as `$applicant` (the same for every viewer of a record — `$user`
// is whoever views it now) and host globals as `$globals`. The demo schema
// shows a finance-only field driven by the applicant's department.
const EVALUATION_CONTEXT: EvaluationContext = {
  applicant: {
    id: "user-admin",
    name: "演示账号",
    departmentId: "dept-finance",
    departmentName: "财务部"
  },
  globals: {
    staffTitle: "主任医师"
  }
};

// The form's system variables: listed in the 变量 tab (with preview samples)
// and offered as a "系统变量" group by the visual condition builder.
const CONTEXT_SOURCES: LinkageContextSource[] = [
  { key: "$applicant.name", label: "发起人姓名" },
  { key: "$applicant.departmentId", label: "发起人部门 ID" },
  { key: "$applicant.departmentName", label: "发起人部门" },
  { key: "$globals.staffTitle", label: "发起人职称" }
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
          dataSourceApis={FORM_DATA_SOURCE_APIS}
          dataSourceResolver={formDataSourceResolver}
          evaluationContext={EVALUATION_CONTEXT}
          initialSchema={DEMO_SCHEMA}
          onPublish={() => showSuccessMessage("Schema 已发布（演示）")}
        />
      </div>
    </Page>
  );
}
