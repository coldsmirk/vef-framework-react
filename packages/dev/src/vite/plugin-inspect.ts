import type { PluginOption } from "vite";

import inspect from "vite-plugin-inspect";

/**
 * Create the inspect plugin for debugging Vite plugin transformations
 */
export function createInspectPlugin(): PluginOption {
  return inspect({
    dev: true,
    build: false
  });
}
