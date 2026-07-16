/**
 * Permission codes for the integration engine management API, mirroring the
 * backend `RequiredPermission` strings verbatim. These are the lockstep
 * anchors between the Go resources and the React pages: every page defaults
 * its permission gates to the matching entry here, and a business system
 * overrides them through the page's `permissions` prop.
 */
export const INTEGRATION_PERMISSIONS = {
  contract: {
    query: "integration.contract.query",
    create: "integration.contract.create",
    update: "integration.contract.update",
    delete: "integration.contract.delete"
  },
  system: {
    query: "integration.system.query",
    create: "integration.system.create",
    update: "integration.system.update",
    delete: "integration.system.delete"
  },
  adapter: {
    query: "integration.adapter.query",
    create: "integration.adapter.create",
    update: "integration.adapter.update",
    delete: "integration.adapter.delete"
  },
  route: {
    query: "integration.route.query",
    create: "integration.route.create",
    update: "integration.route.update",
    delete: "integration.route.delete"
  },
  log: {
    query: "integration.log.query"
  },
  ops: {
    dryRun: "integration.ops.dry_run",
    dryRunInbound: "integration.ops.dry_run_inbound",
    testConnection: "integration.ops.test_connection",
    diagnoseRoutes: "integration.ops.diagnose_routes"
  }
} as const;

export type IntegrationPermissions = typeof INTEGRATION_PERMISSIONS;
export type ContractPermissionCodes = IntegrationPermissions["contract"];
export type SystemPermissionCodes = IntegrationPermissions["system"];
export type AdapterPermissionCodes = IntegrationPermissions["adapter"];
export type RoutePermissionCodes = IntegrationPermissions["route"];
export type LogPermissionCodes = IntegrationPermissions["log"];
export type OpsPermissionCodes = IntegrationPermissions["ops"];
