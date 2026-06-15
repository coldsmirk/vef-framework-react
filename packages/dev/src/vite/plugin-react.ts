import type { PluginOption } from "vite";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import jotaiBabelPreset from "jotai-babel/preset";

/**
 * Babel plugin configuration type
 */
type BabelPlugin = string | [string, Record<string, unknown>];

/**
 * The react plugin options
 */
export interface ReactPluginOptions {
  /**
   * Whether to use emotion
   */
  useEmotion?: boolean;
  /**
   * Whether to use the react compiler
   */
  useCompiler?: boolean;
  /**
   * The babel plugins to use
   */
  babelPlugins?: BabelPlugin[];
}

/**
 * Emotion babel plugin configuration
 */
const emotionBabelPlugin: BabelPlugin = [
  "@emotion",
  {
    sourceMap: true,
    autoLabel: "never",
    cssPropOptimization: true
  }
];

/**
 * Build the list of babel plugins based on options
 */
function buildBabelPlugins(useEmotion: boolean, extraPlugins?: BabelPlugin[]): BabelPlugin[] {
  const plugins: BabelPlugin[] = [];

  if (useEmotion) {
    plugins.push(emotionBabelPlugin);
  }

  if (extraPlugins) {
    plugins.push(...extraPlugins);
  }

  return plugins;
}

function buildBabelPresets(useCompiler: boolean) {
  return useCompiler ? [jotaiBabelPreset, reactCompilerPreset()] : [jotaiBabelPreset];
}

/**
 * Create the React Vite plugin
 *
 * @param options - Plugin configuration options
 * @returns The react plugin
 */
export function createReactPlugin({
  useEmotion = false,
  useCompiler = true,
  babelPlugins
}: ReactPluginOptions = {}): PluginOption {
  return [
    react({
      jsxImportSource: useEmotion ? "@emotion/react" : undefined
    }),
    babel({
      plugins: buildBabelPlugins(useEmotion, babelPlugins),
      presets: buildBabelPresets(useCompiler)
    })
  ];
}
