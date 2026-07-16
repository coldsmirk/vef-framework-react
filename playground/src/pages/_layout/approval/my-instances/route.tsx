import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalMyInstancesPage } from "@vef-framework-react/approval";

export const Route = createFileRoute("/_layout/approval/my-instances")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <ApprovalMyInstancesPage />;
}
