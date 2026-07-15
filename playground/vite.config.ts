import { fileViewerRenderers } from "@file-viewer/vite-plugin";
import { defineViteConfig } from "@vef-framework-react/dev";

export default defineViteConfig({
  resolve: {
    // conditions: ["source", "module", "import", "browser", "development"]
    conditions: ["module", "vef"]
  },
  plugins: [
    // Registers the office renderer line (PDF / Word / Excel / PowerPoint /
    // OFD) for <FileViewer> and copies its worker/WASM assets into the build.
    fileViewerRenderers({
      preset: "office",
      copyAssets: true
    })
  ],
  react: {
    useEmotion: true,
    useCompiler: false
  }
});
