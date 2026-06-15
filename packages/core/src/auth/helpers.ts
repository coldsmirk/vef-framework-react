import type { MaybeArray } from "@vef-framework-react/shared";

import type { PermissionCheckMode } from "./types.js";

import { isNullish, isString } from "@vef-framework-react/shared";

/**
 * Check if the user is authorized to access a resource.
 *
 * @param hasPermission - Function to check if the user has a specific permission token.
 * @param requiredPermissions - Single permission or array of permissions required for access. If nullish, returns true.
 * @param checkMode - "any" requires at least one token match, "all" requires all tokens to match.
 * @returns True if the user has the required permission(s), false otherwise.
 */
export function checkPermission(
  hasPermission: (token: string) => boolean,
  requiredPermissions?: MaybeArray<string>,
  checkMode: PermissionCheckMode = "any"
): boolean {
  if (isNullish(requiredPermissions)) {
    return true;
  }

  const permissions = isString(requiredPermissions) ? [requiredPermissions] : requiredPermissions;

  if (checkMode === "any") {
    return permissions.some(token => hasPermission(token));
  }

  return permissions.every(token => hasPermission(token));
}
