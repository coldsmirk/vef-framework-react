import type { QueryFunction } from "../api";
import type { DataOption } from "../common";

/**
 * The context of the vef app.
 */
export interface AppContext {
  /**
   * Whether the user is authorized to access the resource identified by the token.
   *
   * @example
   * ```ts
   * const isAuthorized = hasPermission("user:query");
   * ```
   * @param token - The permission token.
   * @returns Whether the user has the permission to access the resource identified by the token.
   */
  hasPermission?: (token: string) => boolean;
  /**
   * The query function for fetching host code set entries (the data-dictionary seam).
   * Accepts an array of code set keys and returns a record mapping each key to its options.
   */
  codeSetQueryFn?: QueryFunction<Record<string, DataOption[]>, string[]>;
  /**
   * The base URL for file access.
   */
  fileBaseUrl?: string;
}
