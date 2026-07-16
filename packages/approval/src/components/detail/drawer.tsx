import { Drawer } from "@vef-framework-react/components";

import { InstanceDetailPanel } from "./index";

export interface InstanceDetailDrawerProps {
  /**
   * The instance to show; `null` keeps the drawer closed.
   */
  instanceId: string | null;
  onClose: () => void;
  /**
   * Fired after any successful action inside the detail, so the surrounding
   * list can refetch.
   */
  onActionCompleted?: () => void;
}

/**
 * The self-service instance detail in a wide drawer — the standard container
 * every runtime list page opens on row click.
 */
export function InstanceDetailDrawer({
  instanceId,
  onClose,
  onActionCompleted
}: InstanceDetailDrawerProps) {
  return (
    <Drawer
      destroyOnHidden
      open={instanceId !== null}
      placement="right"
      size={880}
      title="审批详情"
      onClose={onClose}
    >
      {instanceId !== null
        && <InstanceDetailPanel instanceId={instanceId} onActionCompleted={onActionCompleted} />}
    </Drawer>
  );
}
