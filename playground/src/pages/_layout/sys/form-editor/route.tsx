import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@vef-framework-react/components";
import { FormEditor } from "@vef-framework-react/form-editor";

import { DEMO_SCHEMA } from "./demo-schema";

export const Route = createFileRoute("/_layout/sys/form-editor")({
  component: RouteComponent
});

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
          initialSchema={DEMO_SCHEMA}
          onPublish={() => $vef?.message.success("Schema 已发布（演示）")}
        />
      </div>
    </Page>
  );
}
