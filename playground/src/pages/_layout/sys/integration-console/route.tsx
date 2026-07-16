import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { IntegrationConsolePage } from "@vef-framework-react/integration";

export const Route = createFileRoute("/_layout/sys/integration-console")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <IntegrationConsolePage />;
}
