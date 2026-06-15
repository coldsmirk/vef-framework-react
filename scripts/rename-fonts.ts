import { readdir, rename } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";

import { consola } from "consola";
import { dash } from "radashi";

const fontDir = resolve(process.cwd(), "styles/fonts/maple");
const fontExt = ".woff2";

async function main() {
  const files = await readdir(fontDir);

  for (const name of files) {
    const newName = dash(basename(name, fontExt).replace(/^MapleMonoNormal-/, "")) + fontExt;
    await rename(resolve(fontDir, name), resolve(fontDir, newName));
    consola.success(`[@vef-vue/components] renamed ${name} to ${newName}`);
  }
}

await main();
