import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalAdminPage } from "@vef-framework-react/approval";

export const Route = createFileRoute("/_layout/approval/admin")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <ApprovalAdminPage />;
}
