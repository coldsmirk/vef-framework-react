import type { ReactNode } from "react";

import type { FlowPermissionCodes } from "../../permissions";

export interface ApprovalFlowPageProps {
  /**
   * Override the permission codes the page gates its actions on. Defaults to
   * `APPROVAL_PERMISSIONS.flow`.
   */
  permissions?: Partial<FlowPermissionCodes>;
  /**
   * The tenant new flows are created under. Multi-tenant hosts pass the
   * current tenant; single-tenant deployments keep the backend default. A
   * super-admin passes `SHARED_TENANT_ID` to create shared flows, offered to
   * every tenant.
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
