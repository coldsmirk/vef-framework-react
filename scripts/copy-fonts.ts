import { resolve } from "node:path";
import process from "node:process";

import { consola } from "consola";
import { copy } from "fs-extra";

async function main() {
  consola.info("[@vef-vue/components] copying fonts...");

  const cwd = process.cwd();
  const fontsDir = resolve(cwd, "styles", "fonts");
  const distDir = resolve(cwd, "dist", "fonts");

  await copy(fontsDir, distDir);

  consola.success("[@vef-vue/components] fonts copied");
}

await main();
