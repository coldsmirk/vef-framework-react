import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

import { fileViewerOfficeCapabilities } from "./file-viewer-config";

export default defineConfig({
  base: "/static",
  plugins: [fileViewerOfficeCapabilities()],
  resolve: {
    conditions: ["vef", "source", "module", "import", "browser", "development"]
  },
  test: {
    environment: "jsdom",
    env: Object.fromEntries([["BASE_URL", "/static"]]),
    globals: true,
    include: ["./src/**/*.test.{ts,tsx}"],
    setupFiles: [resolve(import.meta.dirname, "../scripts/test-setup.ts")]
  }
});
