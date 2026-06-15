import type { PluginOption } from "vite";

import { snake } from "radashi";
import config from "unplugin-config/vite";

import { DEFAULT_APP_NAME, DEFAULT_OUTPUT_DIR, ENV_APP_PREFIX } from "./constants";

export interface PluginAppConfigOptions {
  /**
   * The base public path
   */
  basePublicPath?: string;
  /**
   * The output directory of the build
   */
  outputDir?: string;
  /**
   * The name of the app
   */
  appName?: string;
}

function toConstantCase(value: string): string {
  return snake(value).toUpperCase();
}

/**
 * Create the app config plugin for runtime configuration injection
 */
export function createAppConfigPlugin({
  basePublicPath,
  outputDir,
  appName = DEFAULT_APP_NAME
}: PluginAppConfigOptions): PluginOption {
  return config({
    appName: `VEF_${toConstantCase(appName)}`,
    baseDir: basePublicPath,
    configFile: {
      generate: true,
      fileName: "app.config.js",
      outputDir: outputDir ?? DEFAULT_OUTPUT_DIR
    },
    htmlInjection: {
      enable: true,
      position: "head-prepend",
      templates: ["index.html"]
    },
    envVariables: {
      prefix: ENV_APP_PREFIX,
      files: ["env/.env", "env/.env.production"]
    }
  });
}
