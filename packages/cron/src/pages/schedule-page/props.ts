import type { ReactNode } from "react";

import type { SchedulePermissionCodes } from "../../permissions";

export interface CronSchedulePageProps {
  /**
   * Override the permission codes the page gates its actions on. Defaults to `CRON_PERMISSIONS.schedule`.
   */
  permissions?: Partial<SchedulePermissionCodes>;
  /**
   * Storage key for the column-settings panel.
   */
  columnStorageKey?: string;
  /**
   * Optional page title rendered above the table.
   */
  title?: ReactNode;
}
