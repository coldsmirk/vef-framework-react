import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { IntegrationAdapterPage } from "@vef-framework-react/integration";

export const Route = createFileRoute("/_layout/sys/integration-adapter")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <IntegrationAdapterPage />;
}
