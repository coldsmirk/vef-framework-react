import process from "node:process";

import consola from "consola";

import { generateDictionaryKeys } from "../../code-generation/dictionary";
import { CliError } from "../utils";

export interface GenDictionaryKeysOptions {
  config?: string;
  output?: string;
  check?: boolean;
}

export async function handleGenDictionaryKeys(
  options: GenDictionaryKeysOptions,
  cwd: string = process.cwd()
): Promise<void> {
  try {
    const result = await generateDictionaryKeys({
      projectDir: cwd,
      configFile: options.config,
      output: options.output,
      check: options.check,
      onWarn: message => consola.warn(message)
    });

    if (options.check && result.changed) {
      throw new CliError(
        `Generated dictionary keys file is stale at ${result.outputPath}. Run \`vef gen:dictionary-keys\` to refresh.`
      );
    }

    const suffix = result.changed ? "" : " (unchanged)";
    consola.success(`Generated ${result.keyCount} dictionary keys -> ${result.outputPath}${suffix}`);
  } catch (error) {
    // Let our own clean failures (e.g. the stale-file guard) pass through untouched.
    if (error instanceof CliError) {
      throw error;
    }

    // In CI logs (often public), surface only the message — not the full stack, which can include
    // absolute workspace paths or jiti source snippets. A CliError prints cleanly (message only);
    // locally, rethrow the original error so the developer sees full detail. Covers non-Error throws.
    if (process.env.CI) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`gen:dictionary-keys failed: ${message}`);
    }

    throw error;
  }
}
