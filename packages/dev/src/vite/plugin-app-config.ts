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
 * Resolve the app config name shared by the generated `app.config.js` global
 * (`__PRODUCTION__<name>__CONF__`, derived by unplugin-config) and the
 * `__VEF_APP_CONFIG__` define constant — both sides must agree on this name.
 */
export function resolveAppConfigName(appName: string = DEFAULT_APP_NAME): string {
  return `VEF_${toConstantCase(appName)}`;
}

/**
 * Create the app config plugin for runtime configuration injection
 */
export function createAppConfigPlugin({
  basePublicPath,
  outputDir,
  appName
}: PluginAppConfigOptions): PluginOption {
  return config({
    appName: resolveAppConfigName(appName),
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
