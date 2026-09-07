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
    ignores: ["**/*.gen.ts", "**/mockServiceWorker.js", "playground/public/vendor/**"]
  }),
  {
    files: ["playground/src/mocks/**/*"],
    rules: {
      "unicorn/no-top-level-side-effects": "off"
    }
  },
  {
    // Shipped runtime code must not carry debug logging: `console.log("DBG"...)`
    // calls reached npm in v2.19.0, firing on every render of every option-backed
    // field. warn / error / info stay allowed — they are the framework's real
    // diagnostic channel (a failed data-source resolve, a failed effect, and
    // `editor/toolbar/notify.ts`'s provider-less fallback all use them).
    // `packages/dev` is exempt: it is build tooling, where stdout IS the output.
    files: ["packages/*/src/**/*.{ts,tsx}"],
    ignores: ["packages/dev/**"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error", "info"] }]
    }
  },
  ...tanstackConfig
);
