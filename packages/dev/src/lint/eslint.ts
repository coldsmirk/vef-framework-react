import type { EslintConfigOptions } from "@coldsmirk/eslint-config";

import { defineEslintConfig as defineCanonEslintConfig } from "@coldsmirk/eslint-config";
import { defineConfig } from "eslint/config";

import { localPlugin } from "./no-legacy-middle-size";
import { tanstackConfig } from "./tanstack";

/**
 * The framework's ESLint flat config for applications: canon's sealed React baseline, the TanStack
 * Query/Router rules, and the one project-specific rule canon doesn't ship —
 * `local/no-legacy-middle-size`. React is on by default (framework applications are React) and
 * generated files (`*.gen.ts`) are ignored. Consumers import this from `@vef-framework-react/dev`
 * and `export default` it.
 */
export function defineEslintConfig(options: EslintConfigOptions = {}): ReturnType<typeof defineConfig> {
  const {
    react = true,
    ignores = [],
    ...rest
  } = options;

  return defineConfig(
    ...defineCanonEslintConfig({
      react,
      ignores: ["**/*.gen.ts", ...ignores],
      ...rest
    }),
    ...tanstackConfig,
    {
      files: ["**/*.{ts,tsx}"],
      plugins: { local: localPlugin },
      rules: { "local/no-legacy-middle-size": "error" }
    }
  );
}
