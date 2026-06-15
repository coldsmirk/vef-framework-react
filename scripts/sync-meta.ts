import { resolve } from "node:path";
import process from "node:process";

import chalk from "chalk";
import { consola } from "consola";
import * as fs from "fs-extra";
import { globby } from "globby";

const readJson = Reflect.get(fs, "default").readJson as (file: string, options?: any) => Promise<any>;
const writeJson = Reflect.get(fs, "default").writeJson as (file: string, data: any, options?: any) => Promise<void>;

async function main() {
  const cwd = process.cwd();
  const packageJson = await readJson(resolve(cwd, "package.json"), "utf-8");
  const { version: rootVersion, packageManager: rootPackageManager } = packageJson;

  const packageFiles = await globby("packages/*/package.json", {
    cwd,
    absolute: true,
    onlyFiles: true
  });

  for (const packageFile of packageFiles) {
    const pkgJson = await readJson(packageFile, "utf-8");
    const {
      name,
      version,
      packageManager
    } = pkgJson;

    if (version === rootVersion && packageManager === rootPackageManager) {
      consola.info(`[${chalk.greenBright(name)}] No changes needed`);
      continue;
    }

    if (version !== rootVersion) {
      consola.success(`[${chalk.blueBright(name)}] Version changed: ${version} -> ${rootVersion}`);
      pkgJson.version = rootVersion;
    }

    if (packageManager !== rootPackageManager) {
      consola.success(`[${chalk.blueBright(name)}] Package manager changed: ${packageManager} -> ${rootPackageManager}`);
      pkgJson.packageManager = rootPackageManager;
    }

    await writeJson(packageFile, pkgJson, { spaces: 2 });
  }
}

await main();
