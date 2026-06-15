import type { PluginOption } from "vite";

import { resolve } from "node:path";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import { PAGES_DIR, ROUTER_DIR, SRC_DIR } from "./constants";

/**
 * Router history mode type
 */
type HistoryMode = "hash" | "browser";

/**
 * File patterns to ignore when scanning for route files
 */
const ROUTE_FILE_IGNORE_PATTERN = "components|hooks|helpers|store|states|types|styles";

/**
 * Build the route tree file header with necessary imports and setup
 */
function buildRouteTreeHeader(): string[] {
  return [
    "/* eslint-disable */",
    "// @ts-nocheck",
    "// noinspection JSUnusedGlobalSymbols",
    "import { createRouter } from \"@vef-framework-react/starter\";",
    "import { routerContext as context } from \"./context\";"
  ];
}

/**
 * Build the route tree file footer with router creation and type registration
 */
function buildRouteTreeFooter(history: HistoryMode): string[] {
  const routerConfig = `const router = createRouter({
  history: "${history}",
  routeTree,
  context
});
`;

  const typeDeclaration = `declare module "@tanstack/react-router" {
  interface Register {
  router: typeof router;
}
}
`;

  return [routerConfig, typeDeclaration, "export default router;"];
}

/**
 * Create the TanStack Router plugin for file-based routing
 *
 * @param projectDir - The project directory
 * @param history - The history mode to use (hash or browser)
 * @returns The router plugin
 */
export function createRouterPlugin(projectDir: string, history: HistoryMode = "browser"): PluginOption {
  return tanstackRouter({
    routesDirectory: resolve(projectDir, SRC_DIR, PAGES_DIR),
    generatedRouteTree: resolve(projectDir, SRC_DIR, ROUTER_DIR, "router.gen.ts"),
    quoteStyle: "double",
    semicolons: true,
    disableTypes: false,
    addExtensions: false,
    disableLogging: false,
    routeFileIgnorePattern: ROUTE_FILE_IGNORE_PATTERN,
    indexToken: "index",
    routeToken: "route",
    enableRouteGeneration: true,
    autoCodeSplitting: true,
    routeTreeFileHeader: buildRouteTreeHeader(),
    routeTreeFileFooter: buildRouteTreeFooter(history)
  });
}
