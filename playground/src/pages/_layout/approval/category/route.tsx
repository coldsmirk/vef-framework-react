import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalCategoryPage } from "@vef-framework-react/approval";

export const Route = createFileRoute("/_layout/approval/category")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <ApprovalCategoryPage />;
}
