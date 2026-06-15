import type { PermissionCheckMode } from "@vef-framework-react/core";
import type { MaybeArray } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

/**
 * The props for the PermissionGate component.
 */
export interface PermissionGateProps {
  /**
   * The permissions required to render the content.
   */
  requiredPermissions?: MaybeArray<string>;
  /**
   * The permission check mode.
   * - "any": Has permission if any of the permissions are granted
   * - "all": Has permission only if all permissions are granted
   *
   * @default "any"
   */
  checkMode?: PermissionCheckMode;
  /**
   * The content to render.
   * - ReactNode: Render if has permission, otherwise render null
   * - Function: Receives hasPermission boolean and returns content to render
   */
  children?: ReactNode | ((hasPermission: boolean) => ReactNode);
}
