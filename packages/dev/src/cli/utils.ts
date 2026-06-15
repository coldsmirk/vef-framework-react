import { resolve } from "node:path";
import { exit } from "node:process";

import consola from "consola";
import { execa } from "execa";
import fsExtra from "fs-extra";

const { readJsonSync } = fsExtra;

/**
 * An expected, user-facing failure. The top-level handler prints its message without a stack trace,
 * distinguishing it from unexpected internal errors.
 */
export class CliError extends Error {}

/**
 * Read the CLI's own version from its package.json — resolved relative to the compiled entry at
 * dist/cli, so two levels up reaches the published package root.
 */
export function readPackageVersion(): string {
  const packageJsonPath = resolve(import.meta.dirname, "../../package.json");
  const packageJson = readJsonSync(packageJsonPath, { encoding: "utf-8" });
  return packageJson.version as string;
}

/**
 * Top-level error sink for the CLI. Expected {@link CliError}s print cleanly (message only); anything
 * else prints with full detail for debugging. Always exits non-zero.
 */
export function handleCliError(error: unknown): never {
  if (error instanceof CliError) {
    consola.error(error.message);
  } else {
    consola.error(error);
  }

  exit(1);
}

/**
 * The CLI assumes pnpm by design. Fail fast with an actionable message when it is missing, instead
 * of surfacing a raw `spawn pnpm ENOENT`.
 */
export async function ensurePnpm(): Promise<void> {
  try {
    await execa("pnpm", ["--version"]);
  } catch {
    throw new CliError("VEF requires pnpm. Install it from https://pnpm.io and try again.");
  }
}
