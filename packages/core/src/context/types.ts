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
   * The query function for fetching data dictionary entries.
   * Accepts an array of dictionary keys and returns a record mapping each key to its options.
   */
  dictionaryQueryFn?: QueryFunction<Record<string, DataOption[]>, string[]>;
  /**
   * The base URL for file access.
   */
  fileBaseUrl?: string;
}
