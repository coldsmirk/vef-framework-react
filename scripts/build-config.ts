import { resolve } from "node:path";
import { cwd } from "node:process";

import babel from "@rolldown/plugin-babel";
import react from "@vitejs/plugin-react";
import dts from "unplugin-dts/vite";
import { defineConfig } from "vite";

import { cssOutputPlugin } from "../plugins";

/**
 * Define the build config for the package.
 */
interface BuildConfigOptions {
  /**
   * The name of the package.
   */
  name: string;
  /**
   * The version of the package.
   */
  version: string;
  /**
   * The author of the package.
   */
  author: string;
  /**
   * Whether to minify output.
   */
  minify?: boolean;
  /**
   * The external dependencies of the package.
   */
  external: Array<string | RegExp>;
  /**
   * Whether to use emotion.
   */
  useEmotion: boolean;
  /**
   * The library entry points. Defaults to a single `src/index.ts`. Pass
   * additional entries to emit extra subpath bundles (e.g. a `./react` export).
   */
  entries?: string[];
}

/**
 * Define the build config for the package.
 *
 * @param options - The options for the build config.
 * @returns The build config.
 */
export function defineBuildConfig(options: BuildConfigOptions) {
  const {
    name,
    version,
    author,
    minify = false,
    external,
    useEmotion,
    entries = ["src/index.ts"]
  } = options;

  // const compilerPlugin = [
  //   "react-compiler",
  //   {
  //     compilationMode: "infer",
  //     panicThreshold: "none",
  //     target: "19",
  //     logger: {
  //       logEvent(filename: string, event: any) {
  //         switch (event.kind) {
  //           case "CompileSuccess": {
  //             console.info(`${chalk.blueBright("[Compiler]")} ✅ ${chalk.greenBright(`Compiled: ${filename}`)}`);
  //             break;
  //           }

  //           case "CompileError": {
  //             console.error(`${chalk.blueBright("[Compiler]")} ❌ ${chalk.redBright(`Skipped: ${filename}`)}`);
  //             console.error(chalk.red(`Reason: ${event.detail.reason}`));

  //             if (event.detail.description) {
  //               console.error(chalk.red(`Details: ${event.detail.description}`));
  //             }

  //             if (event.detail.loc) {
  //               const { line, column } = event.detail.loc.start;
  //               console.error(chalk.red(`Location: Line ${line}, Column ${column}`));
  //             }

  //             if (event.detail.suggestions) {
  //               console.error(chalk.yellow(`Suggestions: ${event.detail.suggestions.map((suggestion: any) => suggestion.description).join(" | ")}`));
  //             }

  //             break;
  //           }

  //           case "CompileSkip": {
  //             console.info(`${chalk.blueBright("[Compiler]")} ℹ️ ${chalk.gray(`Skipped: ${filename}`)}`, event);
  //           }
  //         }
  //       }
  //     }
  //   }
  // ];

  return defineConfig({
    plugins: [
      react({
        jsxImportSource: useEmotion ? "@emotion/react" : undefined
      }),
      ...useEmotion
        ? [
            babel({
              plugins: [
                [
                  "@emotion",
                  {
                    sourceMap: true,
                    autoLabel: "never",
                    cssPropOptimization: true
                  }
                ]
              ]
            })
          ]
        : [],
      dts({
        entryRoot: resolve(cwd(), "src"),
        staticImport: true,
        outDirs: "dist/types",
        exclude: ["**/*.spec.{ts,tsx}", "test-utils.{ts,tsx}", "vite.config.ts"],
        beforeWriteFile: (filePath: string, content: string) => {
          // Inject type-only imports for zustand middleware module
          // augmentations so that Mutate-based types (UseBoundStore,
          // UseBoundStoreWithPersist, etc.) resolve correctly for consumers.
          if (content.includes("\"zustand/persist\"") || content.includes("\"zustand/immer\"")) {
            return {
              filePath,
              content: `import "zustand/middleware";\nimport "zustand/middleware/immer";\n${content}`
            };
          }
        }
      }),
      cssOutputPlugin()
    ],
    resolve: {
      conditions: ["source", "module", "import", "browser", "development"]
    },
    build: {
      lib: {
        entry: entries,
        fileName: (format, entryName) => `${entryName}.${format === "cjs" ? "cjs" : "js"}`
      },
      outDir: "dist",
      target: "esnext",
      sourcemap: false,
      minify: minify ? "esbuild" : undefined,
      rollupOptions: {
        treeshake: false,
        external,
        output: [
          {
            format: "es",
            preserveModules: true,
            preserveModulesRoot: "src",
            exports: "named",
            entryFileNames: "[name].js",
            dir: "dist/es",
            virtualDirname: "_internal",
            banner: `/*! ${name} v${version} made by ${author} | ${new Date().toISOString()} */`
          },
          {
            format: "cjs",
            preserveModules: true,
            preserveModulesRoot: "src",
            exports: "named",
            entryFileNames: "[name].cjs",
            dir: "dist/cjs",
            virtualDirname: "_internal",
            banner: `/*! ${name} v${version} made by ${author} | ${new Date().toISOString()} */`
          }
        ]
      }
    }
  });
}
