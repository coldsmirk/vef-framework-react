import type { OperationButtonProps } from "./props";

import { css } from "@emotion/react";
import { isEmpty } from "@vef-framework-react/shared";

import { globalCssVars } from "../_base";
import { ActionButton } from "../action-button";
import { PermissionGate } from "../permission-gate";

const operationButtonStyle = css({
  height: "calc(var(--vef-control-height-sm) + 2px)",
  "&.vef-btn-sm": {
    "--vef-button-padding-inline-sm": globalCssVars.spacingXxs
  }
});

export function OperationButton({
  checkMode,
  requiredPermissions,
  ...props
}: OperationButtonProps) {
  const actionButtonNode = (
    <ActionButton
      {...props}
      css={operationButtonStyle}
      size="small"
      variant="filled"
    />
  );

  if (isEmpty(requiredPermissions)) {
    return actionButtonNode;
  }

  return (
    <PermissionGate
      checkMode={checkMode}
      requiredPermissions={requiredPermissions}
    >
      {actionButtonNode}
    </PermissionGate>
  );
}

export { type OperationButtonProps } from "./props";
