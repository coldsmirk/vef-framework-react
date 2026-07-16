import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { IntegrationContractPage } from "@vef-framework-react/integration";

export const Route = createFileRoute("/_layout/sys/integration-contract")({
  component: RouteComponent
});

function RouteComponent(): ReactNode {
  return <IntegrationContractPage />;
}
