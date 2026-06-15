import type { Plugin, ProxyOptions } from "vite";

import { createChunksConfig } from "./chunks";
import {
  ASSETS_DIR,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_SERVER_PORT,
  ENV_APP_PREFIX,
  ENV_BUILD_PREFIX,
  ENV_DIR,
  PUBLIC_DIR,
  VEF_FRAMEWORK_VERSION
} from "./constants";
import { defineConstants } from "./define";
import { createPostcssConfig } from "./postcss";

export interface PluginConventionalConfigOptions {
  /**
   * The name of the app
   */
  appName?: string;
  /**
   * The version of the app
   */
  appVersion: string;
  /**
   * The directory of the project
   */
  projectDir: string;
  /**
   * The base public path
   */
  basePublicPath?: string;
  /**
   * The output directory of the build
   */
  outputDir?: string;
  /**
   * The port of the server
   */
  serverPort?: number;
  /**
   * The proxies of the server
   */
  proxies?: Record<string, string | ProxyOptions>;
}

function createBuildBanner(appVersion: string): string {
  const frameworkVersion = `VEF Framework v${VEF_FRAMEWORK_VERSION}`;
  const appVersionStr = appVersion ? ` App version v${appVersion}.` : "";
  const buildTime = new Date().toISOString();

  return `/*! Powered by ${frameworkVersion}.${appVersionStr} Built at ${buildTime} */`;
}

/**
 * Create the conventional config plugin with VEF Framework defaults
 */
export function createConventionalConfigPlugin({
  appName,
  appVersion,
  basePublicPath,
  projectDir,
  outputDir,
  serverPort,
  proxies
}: PluginConventionalConfigOptions): Plugin {
  return {
    name: "vef-framework:conventional-config",

    config(_, { command }) {
      const isDev = command === "serve";
      const finalOutputDir = outputDir ?? DEFAULT_OUTPUT_DIR;

      return {
        appType: "spa",
        root: projectDir,
        base: basePublicPath,
        publicDir: PUBLIC_DIR,
        envDir: ENV_DIR,
        envPrefix: [ENV_BUILD_PREFIX, ENV_APP_PREFIX],
        define: defineConstants(appName, appVersion, isDev),
        css: {
          transformer: "postcss",
          modules: {
            scopeBehaviour: "local",
            localsConvention: "camelCaseOnly",
            exportGlobals: true,
            hashPrefix: "vef"
          },
          postcss: createPostcssConfig(),
          preprocessorOptions: {
            scss: {}
          }
        },
        resolve: {
          dedupe: ["react", "react-dom"]
        },
        optimizeDeps: {},
        build: {
          outDir: finalOutputDir,
          target: "es2024",
          assetsDir: ASSETS_DIR,
          assetsInlineLimit: 10_240,
          reportCompressedSize: false,
          chunkSizeWarningLimit: 5120,
          minify: true,
          cssCodeSplit: true,
          cssMinify: true,
          sourcemap: false,
          rollupOptions: {
            input: {
              main: "index.html"
            },
            output: {
              banner: createBuildBanner(appVersion),
              chunkFileNames: `${ASSETS_DIR}/js/[name]-[hash].js`,
              entryFileNames: `${ASSETS_DIR}/js/[name]-[hash].js`,
              assetFileNames: `${ASSETS_DIR}/[ext]/[name]-[hash].[ext]`,
              manualChunks: createChunksConfig()
            }
          }
        },
        server: {
          port: serverPort || DEFAULT_SERVER_PORT,
          strictPort: true,
          host: true,
          allowedHosts: true,
          open: true,
          proxy: proxies
        }
      };
    }
  };
}
