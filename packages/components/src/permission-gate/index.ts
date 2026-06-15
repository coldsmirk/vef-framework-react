import type { PermissionGateProps } from "./props";

import { useIsAuthorized } from "@vef-framework-react/hooks";
import { isFunction } from "@vef-framework-react/shared";

export function PermissionGate({
  requiredPermissions,
  checkMode,
  children
}: PermissionGateProps) {
  const isAuthorized = useIsAuthorized(requiredPermissions, checkMode);

  if (isFunction(children)) {
    return children(isAuthorized);
  }

  return isAuthorized ? children : null;
}

export { type PermissionGateProps } from "./props";
