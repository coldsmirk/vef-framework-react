import type { Except } from "@vef-framework-react/shared";

import type { ActionButtonProps } from "../action-button";
import type { PermissionGateProps } from "../permission-gate";

/**
 * The props for the OperationButton component.
 *
 * @see {@link ActionButtonProps}
 */
export interface OperationButtonProps
  extends Pick<PermissionGateProps, "checkMode" | "requiredPermissions">,
  Except<ActionButtonProps, "size" | "variant" | "type" | "danger"> {
}
