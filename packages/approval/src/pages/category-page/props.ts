import type { ReactNode } from "react";

import type { CategoryPermissionCodes } from "../../permissions";

export interface ApprovalCategoryPageProps {
  /**
   * Override the permission codes the page gates its CRUD actions on.
   * Defaults to `APPROVAL_PERMISSIONS.category`.
   */
  permissions?: Partial<CategoryPermissionCodes>;
  /**
   * The tenant whose categories the page manages: the tree shows them, and
   * new categories are created under it. Categories are managed across
   * tenants, gated by the permissions — `SHARED_TENANT_ID` manages the shared
   * categories, the home of shared flows. Single-tenant deployments keep the
   * default.
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
