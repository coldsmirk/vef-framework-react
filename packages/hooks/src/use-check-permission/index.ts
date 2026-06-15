import type { PermissionCheckMode } from "@vef-framework-react/core";
import type { MaybeArray } from "@vef-framework-react/shared";

import { checkPermission, useAppContext } from "@vef-framework-react/core";

/**
 * Hook that returns a function to check permissions imperatively.
 *
 * @returns A function that checks if the user has the specified permissions.
 */
export function useCheckPermission(): (
  requiredPermissions?: MaybeArray<string>,
  checkMode?: PermissionCheckMode
) => boolean {
  const { hasPermission = () => true } = useAppContext();

  return (requiredPermissions?: MaybeArray<string>, checkMode?: PermissionCheckMode) => checkPermission(hasPermission, requiredPermissions, checkMode);
}
