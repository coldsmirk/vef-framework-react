import type { PluginOption } from "vite";

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import icons from "unplugin-icons/vite";

/**
 * Get the directory path of the current module
 */
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Create the icons plugin for loading icon sets as React components
 *
 * @param projectDir - The project directory
 * @returns The icons plugin
 */
export function createIconsPlugin(projectDir: string): PluginOption {
  return icons({
    autoInstall: false,
    compiler: "jsx",
    jsx: "react",
    defaultClass: "inline-block",
    scale: 1.2,
    collectionsNodeResolvePath: [projectDir, resolve(CURRENT_DIR, "..")]
  });
}
