import type { ReactNode } from "react";

import type { ContractPermissionCodes } from "../../permissions";

export interface IntegrationContractPageProps {
  /**
   * Override the permission codes the page gates its actions on. Defaults to `INTEGRATION_PERMISSIONS.contract`.
   */
  permissions?: Partial<ContractPermissionCodes>;
  /**
   * Storage key for the column-settings panel.
   */
  columnStorageKey?: string;
  /**
   * Optional page title rendered above the table.
   */
  title?: ReactNode;
}
