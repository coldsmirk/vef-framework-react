import type { PluginOption, ProxyOptions, UserConfig, UserConfigExport } from "vite";

import type { AutoEnhancePlugin } from "./plugin-auto-enhance";
import type { ReactPluginOptions } from "./plugin-react";

import { resolve } from "node:path";
import process from "node:process";

import consola from "consola";
import fs from "fs-extra";
import { defineConfig, loadEnv } from "vite";

import { ENV_BUILD_PREFIX, ENV_DIR } from "./constants";
import { createAppConfigPlugin } from "./plugin-app-config";
import { createAutoEnhancePlugin, operationColumnWidthPlugin } from "./plugin-auto-enhance";
import { createConventionalConfigPlugin } from "./plugin-conventional-config";
import { createEslintPlugin } from "./plugin-eslint";
import { createHtmlPlugin } from "./plugin-html";
import { createIconsPlugin } from "./plugin-icons";
import { createInjectionPlugin } from "./plugin-injection";
import { createInspectPlugin } from "./plugin-inspect";
import { createReactPlugin } from "./plugin-react";
import { createRouterPlugin } from "./plugin-router";
import { createStylelintPlugin } from "./plugin-stylelint";
import { createSvgrPlugin } from "./plugin-svgr";
import { createTsconfigPathsResolveConfig } from "./plugin-tsconfig-paths";

export interface DefineConfigOptions {
  resolve?: Pick<NonNullable<UserConfig["resolve"]>, "alias" | "conditions">;
  plugins?: PluginOption[];
  autoEnhancePlugins?: AutoEnhancePlugin[];
  routerHistory?: "hash" | "browser";
  react?: ReactPluginOptions;
  proxies?: Record<string, string | ProxyOptions>;
}

async function getAppVersion(projectDir: string): Promise<string> {
  const packageJson = await fs.readJson(resolve(projectDir, "package.json"), { encoding: "utf-8" });
  return packageJson.version;
}

export function defineViteConfig(options: DefineConfigOptions = {}): UserConfigExport {
  const {
    resolve,
    plugins = [],
    autoEnhancePlugins = [],
    routerHistory = "browser",
    react,
    proxies
  } = options;

  const projectDir = process.cwd();

  return defineConfig(async ({ mode }) => {
    const env = loadEnv(mode, ENV_DIR, ENV_BUILD_PREFIX);

    if (Object.keys(env).length > 0) {
      consola.info("Loaded environment variables:");
      console.table(env);
    }

    const appVersion = await getAppVersion(projectDir);

    const vitePlugins: PluginOption[] = [
      ...plugins,
      createInspectPlugin(),
      createConventionalConfigPlugin({
        appName: env.VEF_APP_NAME,
        appVersion,
        projectDir,
        basePublicPath: env.VEF_BUILD_BASE_PUBLIC_PATH,
        outputDir: env.VEF_BUILD_OUTPUT_DIR,
        serverPort: Number(env.VEF_BUILD_SERVER_PORT),
        proxies
      }),
      createAutoEnhancePlugin({
        plugins: [operationColumnWidthPlugin, ...autoEnhancePlugins]
      }),
      createRouterPlugin(projectDir, routerHistory),
      createReactPlugin(react),
      createHtmlPlugin(),
      createInjectionPlugin(),
      createAppConfigPlugin({
        basePublicPath: env.VEF_BUILD_BASE_PUBLIC_PATH,
        outputDir: env.VEF_BUILD_OUTPUT_DIR,
        appName: env.VEF_APP_NAME
      }),
      createIconsPlugin(projectDir),
      createSvgrPlugin(),
      createEslintPlugin(),
      createStylelintPlugin()
    ];

    return {
      resolve: {
        ...resolve,
        ...createTsconfigPathsResolveConfig()
      },
      plugins: vitePlugins.filter(Boolean)
    } satisfies UserConfig;
  });
}
