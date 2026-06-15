import type { UserConfig } from "vite";

/**
 * Vite 8 supports tsconfig path resolution natively via `resolve.tsconfigPaths`.
 *
 * This helper keeps the migration logic in one place without relying on the
 * deprecated external plugin.
 */
export function createTsconfigPathsResolveConfig(): Pick<NonNullable<UserConfig["resolve"]>, "tsconfigPaths"> {
  return {
    tsconfigPaths: true
  };
}
