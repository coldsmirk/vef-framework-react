import type { ReactNode } from "react";

import type { DelegationPermissionCodes } from "../../permissions";

export interface ApprovalDelegationPageProps {
  /**
   * Override the permission codes the page gates its CRUD actions on.
   * Defaults to `APPROVAL_PERMISSIONS.delegation`.
   */
  permissions?: Partial<DelegationPermissionCodes>;
  /**
   * The tenant whose categories the category scope offers, beside the shared
   * ones. Omitted, every tenant's categories are offered.
   */
  tenantId?: string;
  /**
   * Storage key for the column-settings panel.
   */
  columnStorageKey?: string;
  /**
   * Optional page title rendered above the table.
   */
  title?: ReactNode;
}
