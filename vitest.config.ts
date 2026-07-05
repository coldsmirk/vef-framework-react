import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDirectory = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  // Pin the Vite cache to the workspace root so a per-package Vite sub-context
  // (triggered when a colocated spec resolves packages/<pkg>/vite.config.ts)
  // cannot create a stray node_modules/.vite cache under that package's src/.
  cacheDir: resolve(rootDirectory, "node_modules/.vite"),
  resolve: {
    alias: {
      "@vef-framework-react/shared": resolve(rootDirectory, "./packages/shared/src"),
      "@vef-framework-react/hooks": resolve(rootDirectory, "./packages/hooks/src"),
      "@vef-framework-react/core": resolve(rootDirectory, "./packages/core/src"),
      "@vef-framework-react/components": resolve(rootDirectory, "./packages/components/src")
    },
    conditions: ["vef", "source", "module", "import", "browser", "development"]
  },
  test: {
    name: "vef-framework",
    include: ["./packages/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./scripts/test-setup.ts"],
    globals: true,
    // Default 5s is too tight for jsdom + react-query + antd specs under
    // parallel-worker load — first render in a fresh worker can spend most
    // of its budget on per-worker setup before the assertion runs. Bumped
    // to 15s so legitimate sync tests aren't killed by infra contention.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportOnFailure: true,
      exclude: [
        // Package-level barrel and core module-level barrels (re-exports only)
        "packages/*/src/index.ts",
        "packages/*/src/index.tsx",
        "packages/core/src/*/index.ts",
        // Type-only and style-only files
        "**/types.ts",
        "**/styles.ts",
        // Specs and test utilities
        "**/*.test.{ts,tsx}",
        "**/test-utils.tsx",
        // Out-of-scope packages (see AGENTS.md > Testing Conventions > What Not to Test)
        "packages/starter/**",
        "packages/dev/**",
        "packages/approval-flow-editor/**",
        "plugins/**",
        "playground/**",
        "scripts/**",
        // Build outputs and dependencies
        "**/dist/**",
        "**/node_modules/**"
      ],
      // Package-level thresholds. Initial values set to (measured baseline - ~5% buffer)
      // and will be raised stage by stage as new specs land. Components has no
      // package-level threshold: must-test components are tracked in the testing plan.
      thresholds: {
        "packages/shared/**": {
          statements: 85,
          branches: 85,
          functions: 80,
          lines: 85
        },
        // hooks branches stays at 30: untested deprioritized hooks
        // (use-chart/use-data-options/use-upload/use-deep) hold the aggregate
        // at ~35%, so 30 leaves the standard ~5% buffer. Other axes have more
        // headroom and are tightened here.
        "packages/hooks/**": {
          statements: 48,
          branches: 30,
          functions: 65,
          lines: 48
        },
        "packages/core/**": {
          statements: 75,
          branches: 60,
          functions: 75,
          lines: 75
        }
      }
    }
  }
});
