import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalDelegationPage } from "@vef-framework-react/approval";

export const Route = createFileRoute("/_layout/approval/delegation")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <ApprovalDelegationPage />;
}
