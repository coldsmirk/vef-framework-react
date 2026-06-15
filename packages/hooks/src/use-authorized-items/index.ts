import type { PermissionCheckMode } from "@vef-framework-react/core";
import type { MaybeArray } from "@vef-framework-react/shared";

import { checkPermission, useAppContext } from "@vef-framework-react/core";

/**
 * Interface for items that have permission requirements.
 */
export interface PermissionAware {
  /**
   * The permissions required to access this item.
   */
  requiredPermissions?: MaybeArray<string>;
  /**
   * The permission check mode (default: "any").
   */
  checkMode?: PermissionCheckMode;
}

/**
 * Hook to filter items based on user permissions.
 *
 * @param items - The items to filter based on permissions.
 * @returns The filtered items that the user is authorized to access.
 */
export function useAuthorizedItems<T extends PermissionAware>(items: T[]): T[] {
  const { hasPermission = () => true } = useAppContext();

  return items.filter(item => {
    const { requiredPermissions, checkMode = "any" } = item;
    return checkPermission(hasPermission, requiredPermissions, checkMode);
  });
}
