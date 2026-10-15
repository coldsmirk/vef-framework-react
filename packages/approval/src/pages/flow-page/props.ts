import type { ReactNode } from "react";

import type { FlowPermissionCodes } from "../../permissions";

export interface ApprovalFlowPageProps {
  /**
   * Override the permission codes the page gates its actions on. Defaults to
   * `APPROVAL_PERMISSIONS.flow`.
   */
  permissions?: Partial<FlowPermissionCodes>;
  /**
   * The tenant whose flows the page manages: the list shows the flows it owns,
   * its shared ones included, and new flows are created under it — shared
   * with every tenant when the designer's switch says so. Flows are managed
   * across tenants, gated by the permissions, so whoever may manage flows may
   * pass any tenant. Single-tenant deployments keep the default.
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
