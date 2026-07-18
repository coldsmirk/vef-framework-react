import chalk from "chalk";
import { program } from "commander";

import { handleGenCodeSetKeys } from "./commands/gen-code-set-keys";
import { handleInit } from "./commands/init";
import { handlePrepare } from "./commands/prepare";
import { handleUpdate } from "./commands/update";
import { handleCliError, readPackageVersion } from "./utils";

const version = readPackageVersion();

program
  .name("vef")
  .description(chalk.magenta("VEF Framework CLI"))
  .version(version)
  // Bare `vef` shows help and exits 0 (a successful "what is this?" lookup), rather than the
  // usage-error path commander takes by default.
  .action(() => program.help());

program
  .command("init")
  .description("Scaffold a new VEF project in a new directory")
  .argument("[name]", "Project directory name (also used as the npm package name)")
  .option("-t, --title <title>", "Human-readable app title")
  .option("--api-url <url>", "Dev API base URL, written to .env.development")
  .action((name, options) => handleInit({
    name,
    title: options.title,
    apiUrl: options.apiUrl
  }));

program
  .command("prepare")
  .description("Install git hooks and lint-staged, and seed package.json scripts")
  .action(() => handlePrepare());

program
  .command("update")
  .description("Update @vef-framework-react/* dependencies within their semver range")
  .action(() => handleUpdate());

program
  .command("gen:code-set-keys")
  .description("Generate the CodeSetKey union type from the project's code-generation config")
  .option("-c, --config <file>", "Path to code-generation.config.ts (relative to cwd or absolute)")
  .option("-o, --output <file>", "Output file path (overrides config.codeSetKeys.output)")
  .option("--check", "Exit non-zero if the generated file would change (CI guard)")
  .action(options => handleGenCodeSetKeys(options));

// parseAsync (not parse) so action handler rejections propagate here; route them through the single
// error sink for consistent output and a deterministic non-zero exit.
try {
  await program.parseAsync();
} catch (error) {
  handleCliError(error);
}
