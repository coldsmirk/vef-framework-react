import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { IntegrationCodeMapPage } from "@vef-framework-react/integration";

export const Route = createFileRoute("/_layout/sys/integration-code-map")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <IntegrationCodeMapPage />;
}
