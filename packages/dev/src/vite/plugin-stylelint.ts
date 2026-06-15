import type { PluginOption } from "vite";

import stylelint from "vite-plugin-stylelint";

/**
 * File patterns to lint for styles
 */
const INCLUDE_PATTERNS = ["src/**/*.{css,scss}"];

/**
 * Patterns to exclude from style linting
 */
const EXCLUDE_PATTERNS = ["node_modules", "virtual:", "vef:"];

/**
 * Create the Stylelint plugin for development-time style linting
 *
 * @returns The stylelint plugin
 */
export function createStylelintPlugin(): PluginOption {
  return stylelint({
    fix: false,
    test: false,
    dev: true,
    build: false,
    cache: true,
    cacheLocation: "node_modules/.cache/.stylelintcache",
    include: INCLUDE_PATTERNS,
    exclude: EXCLUDE_PATTERNS,
    emitError: true,
    emitWarning: true,
    emitWarningAsError: true
  });
}
