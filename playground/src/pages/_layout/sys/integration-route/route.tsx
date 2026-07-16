import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { IntegrationRoutePage } from "@vef-framework-react/integration";

export const Route = createFileRoute("/_layout/sys/integration-route")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <IntegrationRoutePage />;
}
