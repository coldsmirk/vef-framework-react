import type { ReactNode } from "react";

import type { CategoryPermissionCodes } from "../../permissions";

export interface ApprovalCategoryPageProps {
  /**
   * Override the permission codes the page gates its CRUD actions on.
   * Defaults to `APPROVAL_PERMISSIONS.category`.
   */
  permissions?: Partial<CategoryPermissionCodes>;
  /**
   * The tenant new categories are created under. Multi-tenant hosts pass the
   * current tenant; single-tenant deployments keep the backend default.
   *
   * @default "default"
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
