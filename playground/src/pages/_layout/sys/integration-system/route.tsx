import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { IntegrationSystemPage } from "@vef-framework-react/integration";

export const Route = createFileRoute("/_layout/sys/integration-system")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <IntegrationSystemPage />;
}
