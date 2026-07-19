/**
 * Permission codes for the durable cron store management API, mirroring the
 * backend `RequiredPermission` strings verbatim. These are the lockstep
 * anchors between the Go resources and the React pages: every page defaults
 * its permission gates to the matching entry here, and a business system
 * overrides them through the page's `permissions` prop.
 *
 * All schedule mutations (create / update / delete / pause / resume /
 * trigger_now) share the single `manage` code — there are no per-action codes.
 */
export const CRON_PERMISSIONS = {
  schedule: {
    query: "cron.schedule.query",
    manage: "cron.schedule.manage"
  },
  run: {
    query: "cron.run.query"
  }
} as const;

export type CronPermissions = typeof CRON_PERMISSIONS;
export type SchedulePermissionCodes = CronPermissions["schedule"];
export type RunPermissionCodes = CronPermissions["run"];
