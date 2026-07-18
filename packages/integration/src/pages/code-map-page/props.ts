import type { ReactNode } from "react";

import type { CodeMapPermissionCodes } from "../../permissions";

export interface IntegrationCodeMapPageProps {
  /**
   * Override the permission codes the page gates its actions on. Defaults to `INTEGRATION_PERMISSIONS.codeMap`.
   */
  permissions?: Partial<CodeMapPermissionCodes>;
  /**
   * Storage key for the column-settings panel.
   */
  columnStorageKey?: string;
  /**
   * Optional page title rendered above the table.
   */
  title?: ReactNode;
}
