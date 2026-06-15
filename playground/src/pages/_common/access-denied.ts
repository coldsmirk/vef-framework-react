import { createFileRoute } from "@tanstack/react-router";
import { createAccessDeniedRouteOptions } from "@vef-framework-react/starter";

export const Route = createFileRoute("/_common/access-denied")(
  createAccessDeniedRouteOptions()
);
