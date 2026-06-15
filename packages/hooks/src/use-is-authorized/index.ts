import type { PermissionCheckMode } from "@vef-framework-react/core";
import type { MaybeArray } from "@vef-framework-react/shared";

import { checkPermission, useAppContext } from "@vef-framework-react/core";

/**
 * Hook to check if the user satisfies the required permissions.
 *
 * @param requiredPermissions - The permissions required for access.
 * @param checkMode - The check mode to use (default: "any").
 * @returns Whether the user is authorized to access the resource.
 */
export function useIsAuthorized(requiredPermissions?: MaybeArray<string>, checkMode?: PermissionCheckMode): boolean {
  const { hasPermission = () => true } = useAppContext();

  return checkPermission(hasPermission, requiredPermissions, checkMode);
}
