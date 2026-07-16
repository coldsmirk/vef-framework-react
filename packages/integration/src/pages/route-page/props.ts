import type { ReactNode } from "react";

import type { RoutePermissionCodes } from "../../permissions";

export interface IntegrationRoutePageProps {
  /**
   * Override the permission codes the page gates its actions on. Defaults to `INTEGRATION_PERMISSIONS.route`.
   */
  permissions?: Partial<RoutePermissionCodes>;
  /**
   * Storage key for the column-settings panel.
   */
  columnStorageKey?: string;
  /**
   * Optional page title rendered above the table.
   */
  title?: ReactNode;
}
