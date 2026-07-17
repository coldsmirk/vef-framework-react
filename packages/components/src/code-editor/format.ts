import type { CodeEditorLanguage } from "./props";

import { isString } from "@vef-framework-react/shared";

/**
 * A formatter rewrites a whole document, returning the formatted text.
 * It throws when the source cannot be parsed.
 */
export type CodeFormatter = (source: string, tabSize: number) => Promise<string> | string;

/**
 * Format through prettier's standalone build. The engine and its plugins are
 * imported on first use so they load as their own chunk and never enter the
 * initial bundle.
 */
async function formatWithPrettier(source: string, tabSize: number, parser: "babel" | "babel-ts"): Promise<string> {
  const [standalone, babel, estree] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree")
  ]);

  return standalone.format(source, {
    parser,
    plugins: [babel.default, estree.default],
    tabWidth: tabSize,
    printWidth: 100
  });
}

const FORMATTERS: Partial<Record<CodeEditorLanguage, CodeFormatter>> = {
  json: (source, tabSize) => JSON.stringify(JSON.parse(source), null, tabSize),
  javascript: (source, tabSize) => formatWithPrettier(source, tabSize, "babel"),
  typescript: (source, tabSize) => formatWithPrettier(source, tabSize, "babel-ts")
};

/**
 * The built-in formatter for a `language` prop value, or undefined when the
 * language is a custom extension or has no formatter.
 */
export function getFormatter(language: unknown): CodeFormatter | undefined {
  return isString(language) ? FORMATTERS[language as CodeEditorLanguage] : undefined;
}
