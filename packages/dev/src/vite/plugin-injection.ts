import type { PluginOption } from "vite";

/**
 * Create the injection plugin for code injection into entry files
 */
export function createInjectionPlugin(): PluginOption {
  return {
    name: "vef-framework:injection"
  };
}
