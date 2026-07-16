import type { ReactNode } from "react";

import type { SystemPermissionCodes } from "../../permissions";

export interface IntegrationSystemPageProps {
  /**
   * Override the permission codes the page gates its CRUD actions on. Defaults to `INTEGRATION_PERMISSIONS.system`.
   */
  permissions?: Partial<SystemPermissionCodes>;
  /**
   * Permission code for the test-connection action. Defaults to `INTEGRATION_PERMISSIONS.ops.testConnection`.
   */
  testConnectionPermission?: string;
  /**
   * Storage key for the column-settings panel.
   */
  columnStorageKey?: string;
  /**
   * Optional page title rendered above the table.
   */
  title?: ReactNode;
}
