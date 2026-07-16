import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalInitiatePage } from "@vef-framework-react/approval";

export const Route = createFileRoute("/_layout/approval/initiate")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <ApprovalInitiatePage />;
}
