import type { Plugin } from "vite";

import type { AutoEnhanceOptions } from "./types";

import { AutoEnhanceCore } from "./core";

/**
 * Create auto-enhance plugin for AST transformations.
 * Supports registering multiple sub-plugins to handle different code enhancement needs.
 */
export function createAutoEnhancePlugin({
  plugins,
  ...options
}: AutoEnhanceOptions = {}): Plugin {
  const core = new AutoEnhanceCore(options);

  if (plugins) {
    core.registerPlugins(plugins);
  }

  return {
    name: "vef-framework:auto-enhance",
    enforce: "pre",

    buildStart() {
      const registeredPlugins = core.getRegisteredPlugins();

      if (registeredPlugins.length === 0) {
        return;
      }

      console.log(`Auto-Enhance: Loaded ${registeredPlugins.length} plugins:`);

      for (const plugin of registeredPlugins) {
        const description = plugin.description ? ` - ${plugin.description}` : "";
        console.log(`   - ${plugin.name}${description}`);
      }
    },

    transform(code: string, id: string) {
      return core.transform(code, id);
    }
  };
}

// Export types and sub-plugins
export * from "./plugins";
export type * from "./types";
export { types } from "recast";
