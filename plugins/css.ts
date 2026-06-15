import type { Plugin } from "vite";

import { isAbsolute } from "node:path";

import { createFilter } from "@rollup/pluginutils";
import fsExtra from "fs-extra";

const { readFile } = fsExtra;

/**
 * The css plugin for vef framework.
 *
 * @returns The css plugin for vef framework.
 */
export default function cssPlugin(): Plugin {
  const filter = createFilter(["**/*.css", "**/*.css?raw"], []);
  const VIRTUAL_CSS_PREFIX = "\0vef-virtual-inline-css:";

  return {
    name: "@vef-framework-react/css",
    async resolveId(source, importer, options) {
      if (!filter(source) || isAbsolute(source)) {
        return null;
      }

      const result = await this.resolve(source, importer, options);

      if (!result) {
        return result;
      }

      return {
        id: VIRTUAL_CSS_PREFIX + result.id,
        moduleSideEffects: false
      };
    },
    async load(id) {
      if (!id.startsWith(VIRTUAL_CSS_PREFIX)) {
        return null;
      }

      const realId = id.slice(VIRTUAL_CSS_PREFIX.length);
      const code = await readFile(
        realId.endsWith("?raw") ? realId.slice(0, -4) : realId,
        { encoding: "utf-8" }
      );
      return {
        code: `export default ${JSON.stringify(code)};`,
        map: { mappings: "" }
      };
    }
  };
}
