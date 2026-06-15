import type { PluginOption } from "vite";

import svgr from "vite-plugin-svgr";

/**
 * Create the SVGR plugin for converting SVG files to React components
 *
 * @returns The svgr plugin
 */
export function createSvgrPlugin(): PluginOption {
  return svgr({
    include: "**/*.svg?react",
    esbuildOptions: {
      platform: "browser",
      minify: true,
      jsx: "automatic"
    },
    svgrOptions: {
      plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
      icon: false,
      dimensions: false,
      prettier: true,
      memo: true,
      svgo: true,
      ref: false,
      typescript: true,
      jsxRuntime: "automatic",
      svgoConfig: {
        multipass: true,
        datauri: "base64",
        js2svg: {
          indent: 2,
          pretty: true
        },
        plugins: [
          "preset-default",
          {
            name: "prefixIds",
            params: { prefix: "vef" }
          },
          {
            name: "cleanupIds",
            params: {
              force: true,
              remove: true,
              minify: true
            }
          }
        ]
      },
      svgProps: {}
    }
  });
}
