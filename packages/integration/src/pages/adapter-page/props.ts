import type { ReactNode } from "react";

import type { AdapterPermissionCodes } from "../../permissions";

export interface IntegrationAdapterPageProps {
  /**
   * Override the permission codes the page gates its actions on. Defaults to `INTEGRATION_PERMISSIONS.adapter`.
   */
  permissions?: Partial<AdapterPermissionCodes>;
  /**
   * Storage key for the column-settings panel.
   */
  columnStorageKey?: string;
  /**
   * Optional page title rendered above the table.
   */
  title?: ReactNode;
}
