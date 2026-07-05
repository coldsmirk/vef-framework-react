import { resolve } from "node:path";
import process from "node:process";

import consola from "consola";
import fsExtra from "fs-extra";

import { HUSKY_HOOKS, LINT_STAGED_CONFIG, REQUIRED_SCRIPTS } from "../constants";

const {
  exists,
  readJson,
  writeFile,
  writeJson
} = fsExtra;

export async function handlePrepare(cwd: string = process.cwd()): Promise<void> {
  const packageJsonPath = resolve(cwd, "package.json");

  // husky keeps its hook wrappers under `.husky/_`, which husky itself gitignores — so a freshly
  // cloned consumer repo has the committed hook files but no `_`, leaving git's hooksPath pointing at
  // nothing until husky runs again. Re-run it on every prepare (husky's recommended pattern): it is
  // idempotent and returns a reason string instead of throwing when it has to skip (no .git, HUSKY=0).
  const { default: husky } = await import("husky");
  const skipReason = husky();

  if (skipReason) {
    consola.warn(`Skipped husky setup: ${skipReason}`);
  } else {
    // Check each hook independently and create whichever is missing — the `.husky` dir already
    // existing must not short-circuit a hook that was never written (or was later removed).
    for (const [name, content] of Object.entries(HUSKY_HOOKS)) {
      const hookPath = resolve(cwd, ".husky", name);

      if (!await exists(hookPath)) {
        await writeFile(hookPath, content);
        consola.success(`Successfully set up ${name} hook`);
      }
    }
  }

  const packageJson = await readJson(packageJsonPath, { encoding: "utf-8" });
  packageJson.scripts ??= {};
  const { scripts } = packageJson;
  let changed = false;

  for (const [name, command] of Object.entries(REQUIRED_SCRIPTS)) {
    const existingScript = scripts[name];

    if (existingScript) {
      continue;
    }

    scripts[name] = command;
    changed = true;
  }

  if (!packageJson["lint-staged"]) {
    packageJson["lint-staged"] = { ...LINT_STAGED_CONFIG };
    changed = true;
  }

  if (changed) {
    await writeJson(packageJsonPath, packageJson, { encoding: "utf-8", spaces: 2 });
    consola.success("Successfully set up package.json scripts and lint-staged");
  }
}
