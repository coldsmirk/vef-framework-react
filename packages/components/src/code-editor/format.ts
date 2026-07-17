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
async function formatWithPrettier(source: string, tabSize: number, parser: "babel" | "babel-ts" | "json"): Promise<string> {
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
  // JSON goes through prettier too: it reprints tokens verbatim, so number
  // literals beyond 2^53 (large numeric ids) survive formatting — a
  // JSON.parse/stringify round-trip would silently rewrite them. Prettier
  // keeps a single-line object single-line, so a fully minified document gets
  // a newline seeded after its opening brace to make the root expand.
  json: (source, tabSize) => {
    const seeded = source.includes("\n") ? source : source.replace(/^\s*\{/, "{\n");

    return formatWithPrettier(seeded, tabSize, "json");
  },
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
