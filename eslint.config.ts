import { defineEslintConfig } from "@coldsmirk/eslint-config";
import { defineConfig } from "eslint/config";

import { tanstackConfig } from "./packages/dev/src/lint/tanstack";

// canon's sealed config + the TanStack Query/Router rules. The project-specific
// `no-legacy-middle-size` rule is deliberately NOT applied here (it ships to applications only via
// `@vef-framework-react/dev`): the framework's own internals — e.g. antd adapters — legitimately use
// the "middle" / "default" literals that rule forbids.
export default defineConfig(
  ...defineEslintConfig({
    type: "app",
    react: true,
    ignores: ["**/*.gen.ts", "**/mockServiceWorker.js"]
  }),
  ...tanstackConfig
);
