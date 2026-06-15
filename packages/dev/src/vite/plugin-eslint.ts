import type { PluginOption } from "vite";

import eslint from "vite-plugin-eslint2";

/**
 * File patterns to lint
 */
const INCLUDE_PATTERNS = ["*.{js,ts,json,yaml,md}", "src/**/*.{ts,tsx,json,yaml,md}"];

/**
 * Patterns to exclude from linting
 */
const EXCLUDE_PATTERNS = ["node_modules", "virtual:", "vef:"];

/**
 * Create the ESLint plugin for development-time linting
 *
 * @returns The eslint plugin
 */
export function createEslintPlugin(): PluginOption {
  return eslint({
    fix: false,
    test: false,
    dev: true,
    build: false,
    cache: true,
    cacheLocation: "node_modules/.cache/.eslintcache",
    include: INCLUDE_PATTERNS,
    exclude: EXCLUDE_PATTERNS,
    emitError: true,
    emitWarning: true,
    emitWarningAsError: true
  });
}
