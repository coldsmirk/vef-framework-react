import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalTaskCenterPage } from "@vef-framework-react/approval";

export const Route = createFileRoute("/_layout/approval/task-center")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <ApprovalTaskCenterPage />;
}
