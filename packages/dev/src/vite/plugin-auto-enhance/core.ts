import type { Except } from "type-fest";
import type { TransformResult } from "vite";

import type { AutoEnhanceContext, AutoEnhanceOptions, AutoEnhancePlugin, FilePattern } from "./types";

import { basename } from "node:path";

import { parse as babelParse } from "@babel/parser";
import { parse, print } from "recast";

const DEFAULT_INCLUDE = [/\.tsx?(?:\?.*)?$/];
const DEFAULT_EXCLUDE = [/node_modules/, /\.d\.ts?(?:\?.*)?$/];
const DEFAULT_LOG_PREFIX = "VEF Auto-Enhance";

function matchesPattern(patterns: FilePattern, target: string): boolean {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];

  return patternArray.some(pattern => {
    if (typeof pattern === "string") {
      return target.includes(pattern);
    }

    return pattern.test(target);
  });
}

function parseCode(code: string, fileName: string): ReturnType<typeof parse> {
  return parse(code, {
    sourceFileName: fileName,
    parser: {
      parse: (source: string) => babelParse(source, {
        plugins: ["jsx", "typescript", "explicitResourceManagement"],
        sourceType: "module",
        tokens: true
      })
    }
  });
}

type CoreOptions = Required<Except<AutoEnhanceOptions, "plugins">>;

/**
 * Auto-enhance core engine
 */
export class AutoEnhanceCore {
  private plugins: AutoEnhancePlugin[] = [];
  private options: CoreOptions;

  constructor(options: Except<AutoEnhanceOptions, "plugins"> = {}) {
    this.options = {
      include: DEFAULT_INCLUDE,
      exclude: DEFAULT_EXCLUDE,
      logPrefix: DEFAULT_LOG_PREFIX,
      ...options
    };
  }

  registerPlugin(plugin: AutoEnhancePlugin): void {
    this.plugins.push(plugin);
  }

  registerPlugins(plugins: AutoEnhancePlugin[]): void {
    for (const plugin of plugins) {
      this.plugins.push(plugin);
    }
  }

  getRegisteredPlugins(): Array<Pick<AutoEnhancePlugin, "name" | "description">> {
    return this.plugins.map(({ name, description }) => {
      return {
        name,
        description
      };
    });
  }

  transform(code: string, id: string): TransformResult | null {
    if (!this.shouldProcessFile(id) || this.plugins.length === 0) {
      return null;
    }

    try {
      return this.executeTransform(code, id);
    } catch (error) {
      console.warn(`${this.options.logPrefix}: Error processing ${id}:`, error);
      return null;
    }
  }

  private shouldProcessFile(id: string): boolean {
    const { include, exclude } = this.options;

    if (exclude && matchesPattern(exclude, id)) {
      return false;
    }

    if (include && !matchesPattern(include, id)) {
      return false;
    }

    return true;
  }

  private buildTransformInfo(id: string, code: string): AutoEnhanceContext {
    const fileName = id.split("/").slice(-3).join("/");
    const ast = parseCode(code, basename(id));

    return {
      id,
      fileName,
      code,
      ast
    };
  }

  private executeTransform(code: string, id: string): TransformResult | null {
    const info = this.buildTransformInfo(id, code);
    const activePlugins = this.getActivePlugins(info);

    if (activePlugins.length === 0) {
      return null;
    }

    const { hasChanges, logs } = this.runPlugins(activePlugins, info);

    for (const log of logs) {
      console.log(log);
    }

    if (!hasChanges) {
      return null;
    }

    const result = print(info.ast);
    return {
      code: result.code,
      map: result.map || null
    };
  }

  private getActivePlugins(context: AutoEnhanceContext): AutoEnhancePlugin[] {
    return this.plugins.filter(plugin => {
      if (plugin.shouldProcess) {
        return plugin.shouldProcess(context);
      }

      return true;
    });
  }

  private runPlugins(
    plugins: AutoEnhancePlugin[],
    context: AutoEnhanceContext
  ): { hasChanges: boolean; logs: string[] } {
    let hasChanges = false;
    const logs: string[] = [];
    const { logPrefix } = this.options;

    for (const plugin of plugins) {
      try {
        const result = plugin.transform(context);

        if (result.hasChanges) {
          hasChanges = true;
          console.log(`${logPrefix}: Plugin "${plugin.name}" made changes to ${context.fileName}`);
        }

        if (result.logs) {
          logs.push(...result.logs);
        }
      } catch (error) {
        console.warn(`${logPrefix}: Plugin "${plugin.name}" failed:`, error);
      }
    }

    return { hasChanges, logs };
  }
}
