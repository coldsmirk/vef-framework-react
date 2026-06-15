import { defineViteConfig } from "@vef-framework-react/dev";

export default defineViteConfig({
  resolve: {
    // conditions: ["source", "module", "import", "browser", "development"]
    conditions: ["module", "vef"]
  },
  react: {
    useEmotion: true,
    useCompiler: false
  }
});
