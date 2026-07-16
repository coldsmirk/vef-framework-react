import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalFlowPage } from "@vef-framework-react/approval";

export const Route = createFileRoute("/_layout/approval/flow")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <ApprovalFlowPage />;
}
