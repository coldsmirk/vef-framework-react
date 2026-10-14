import type { ReactNode } from "react";

import type { FlowPermissionCodes } from "../../permissions";

export interface ApprovalFlowPageProps {
  /**
   * Override the permission codes the page gates its actions on. Defaults to
   * `APPROVAL_PERMISSIONS.flow`.
   */
  permissions?: Partial<FlowPermissionCodes>;
  /**
   * The tenant whose flows the page manages: the list shows them, and new
   * flows are created under it. Flows are managed across tenants, gated by
   * the permissions, so whoever may manage flows may pass any tenant —
   * `SHARED_TENANT_ID` manages the shared flows, offered to every tenant.
   * Single-tenant deployments keep the default.
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
