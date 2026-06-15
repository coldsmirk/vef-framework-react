import fsExtra from "fs-extra";
import { defineConfig } from "tsup";

import packageJson from "./package.json";

const { copy } = fsExtra;

export default defineConfig({
  banner: () => {
    const banner = `/*! ${packageJson.name} v${packageJson.version} made by ${packageJson.author.name} | ${new Date().toISOString()} */`;
    return {
      js: banner,
      css: banner
    };
  },
  dts: false,
  bundle: true,
  entry: ["src/cli/index.ts"],
  outDir: "dist/cli",
  format: "esm",
  platform: "node",
  minify: true,
  external: [
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.peerDependencies)
  ],
  // Ship the `vef init` scaffold template (a sibling of `src`, since it is copied
  // verbatim into generated apps rather than compiled). The CLI reads it from
  // `../template` relative to `dist/cli`, so copy it to `dist/template`;
  // `files: ["dist"]` then publishes it.
  async onSuccess() {
    await copy("template", "dist/template");
  }
});
