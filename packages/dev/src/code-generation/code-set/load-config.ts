import type { CodeGenerationConfig, CodeSetKeysConfig } from "./types";

import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { createJiti } from "jiti";

import { CodeGenerationValidationError } from "./errors";

const DEFAULT_CONFIG_FILES = [
  "code-generation.config.ts",
  "code-generation.config.mts",
  "code-generation.config.js",
  "code-generation.config.mjs"
];

export interface LoadCodeGenerationConfigOptions {
  projectDir: string;
  configFile?: string;
}

export interface LoadedCodeGenerationConfig {
  config: CodeGenerationConfig;
  configPath: string;
}

/**
 * Load `code-generation.config.{ts,mts,js,mjs}` from the project root via jiti so
 * TypeScript configs work without a prior build step. The first existing
 * candidate wins.
 *
 * Path safety: an explicit `configFile` is rejected if it escapes the
 * project tree.
 *
 * Shape safety: the loaded module is validated at the trust boundary —
 * if a `codeSetKeys` block is present, its `fetchCodeSetKeys` must
 * be a function, `output` must be a string or absent, `timeout` must be a
 * finite non-negative number or absent.
 */
export async function loadCodeGenerationConfig({
  projectDir,
  configFile
}: LoadCodeGenerationConfigOptions): Promise<LoadedCodeGenerationConfig> {
  const candidates = configFile
    ? [resolveConfigFile(projectDir, configFile)]
    : DEFAULT_CONFIG_FILES.map(name => resolve(projectDir, name));

  const configPath = candidates.find(path => existsSync(path));

  if (!configPath) {
    throw new CodeGenerationValidationError(`Code generation config not found. Looked for: ${candidates.join(", ")}`);
  }

  const jiti = createJiti(projectDir);
  const loaded = await jiti.import<CodeGenerationConfig | { default: CodeGenerationConfig }>(configPath);
  const candidate = unwrapDefaultExport(loaded);

  validateCodeGenerationConfigShape(candidate, configPath);

  return { config: candidate, configPath };
}

function resolveConfigFile(projectDir: string, configFile: string): string {
  const resolved = isAbsolute(configFile) ? configFile : resolve(projectDir, configFile);
  const rel = relative(projectDir, resolved);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new CodeGenerationValidationError(
      `Code generation config file escapes project root: ${configFile}. Must stay within ${projectDir}.`
    );
  }

  return resolved;
}

/**
 * Normalize the two shapes jiti can return: a default-export wrapper (ESM
 * `{ default: ... }`) or the bare config object (CJS `module.exports = ...`).
 */
function unwrapDefaultExport(
  loaded: CodeGenerationConfig | { default: CodeGenerationConfig }
): CodeGenerationConfig {
  if (loaded !== null
    && typeof loaded === "object"
    && "default" in loaded
    && loaded.default !== null
    && typeof loaded.default === "object") {
    return loaded.default;
  }

  return loaded as CodeGenerationConfig;
}

function validateCodeGenerationConfigShape(config: CodeGenerationConfig, configPath: string): void {
  if (typeof config !== "object" || config === null) {
    throw new CodeGenerationValidationError(
      `Code generation config at ${configPath} must export a CodeGenerationConfig object.`
    );
  }

  if (config.codeSetKeys !== undefined) {
    validateCodeSetKeysShape(config.codeSetKeys, configPath);
  }
}

function validateCodeSetKeysShape(block: CodeSetKeysConfig, configPath: string): void {
  if (typeof block !== "object" || block === null) {
    throw new CodeGenerationValidationError(
      `Code generation config at ${configPath} field \`codeSetKeys\` must be an object when set.`
    );
  }

  if (typeof block.fetchCodeSetKeys !== "function") {
    throw new CodeGenerationValidationError(
      `Code generation config at ${configPath} field \`codeSetKeys.fetchCodeSetKeys\` must be a function.`
    );
  }

  if (block.output !== undefined && typeof block.output !== "string") {
    throw new CodeGenerationValidationError(
      `Code generation config at ${configPath} field \`codeSetKeys.output\` must be a string when set; got ${typeof block.output}.`
    );
  }

  if (block.timeout !== undefined && !isNonNegativeFiniteNumber(block.timeout)) {
    throw new CodeGenerationValidationError(
      `Code generation config at ${configPath} field \`codeSetKeys.timeout\` must be a finite non-negative number when set; got ${String(block.timeout)}.`
    );
  }
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
