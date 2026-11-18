import { useQueryClient } from "@vef-framework-react/core";

import { useAdminApprovalApi, useMyApprovalApi } from "../../api";

/**
 * A void changes both views of the target, even if an open detail cache has already gone stale.
 */
export function useRefreshVoidTarget() {
  const client = useQueryClient();
  const admin = useAdminApprovalApi();
  const my = useMyApprovalApi();
  return (instanceId: string) => Promise.all([
    client.invalidateQueries({ queryKey: [admin.getInstanceDetail.key, { instanceId }] }),
    client.invalidateQueries({ queryKey: [my.getInstanceDetail.key, { instanceId }] }),
    ...[admin.findInstances.key, admin.findActionLogs.key, admin.findBusinessProjections.key, admin.getMetrics.key, my.findInitiated.key, my.findCompletedTasks.key].map(key => client.invalidateQueries({ queryKey: [key] }))
  ]);
}
