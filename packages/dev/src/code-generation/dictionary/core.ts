import type { DictionaryKeyEntry, DictionaryKeysConfig } from "./types";

import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { CodeGenerationValidationError } from "./errors";
import { loadCodeGenerationConfig } from "./load-config";
import { renderDictionaryKeysFile } from "./render";

const DEFAULT_OUTPUT = "src/types/dictionary.gen.ts";
const DEFAULT_TIMEOUT_MS = 30_000;
const KEY_CHARSET_PATTERN = /^[\w.-]+$/;
const KEY_CHARSET_DESCRIPTION = "letters, digits, underscore, dot, hyphen";
const DEFAULT_WARN: (message: string) => void = message => console.warn(message);

export interface GenerateDictionaryKeysOptions {
  /**
   * Absolute path to the project root.
   */
  projectDir: string;
  /**
   * Override the auto-detected config file path (relative to `projectDir` or absolute).
   */
  configFile?: string;
  /**
   * Override `output` from the config file.
   */
  output?: string;
  /**
   * Dry-run: compute `changed` without writing to disk.
   */
  check?: boolean;
  /**
   * Module name the generated file augments. Defaults to
   * `@vef-framework-react/hooks`; downstream forks that re-export the
   * extension point under a different package name can override this.
   */
  augmentTarget?: string;
  /**
   * Warning sink for non-fatal messages (duplicate keys with conflicting
   * comments, empty fetcher result). Defaults to `console.warn`.
   */
  onWarn?: (message: string) => void;
}

export interface GenerateDictionaryKeysResult {
  /**
   * Absolute path of the generated file.
   */
  outputPath: string;
  /**
   * Number of unique keys emitted into the union (zero produces `never`).
   */
  keyCount: number;
  /**
   * Whether the file would be written (or was written, when not in check mode).
   */
  changed: boolean;
}

/**
 * Run the dictionary keys generator.
 *
 * Strict failure modes (throws):
 * - missing config file or invalid config shape → `CodeGenerationValidationError`
 * - config has no `dictionaryKeys` block → `CodeGenerationValidationError`
 * - any returned key violates the key charset → `CodeGenerationValidationError`
 * - `output` path escapes `projectDir` or points to a symlink → `CodeGenerationValidationError`
 * - fetcher throws or times out → propagates the underlying error
 *
 * Soft failure modes (warn, continue):
 * - empty fetcher result → generates `DictionaryKey = never`
 * - duplicate keys with conflicting comments → first occurrence wins
 */
export async function generateDictionaryKeys({
  projectDir,
  configFile,
  output,
  check = false,
  augmentTarget,
  onWarn = DEFAULT_WARN
}: GenerateDictionaryKeysOptions): Promise<GenerateDictionaryKeysResult> {
  const { config, configPath } = await loadCodeGenerationConfig({ projectDir, configFile });

  if (!config.dictionaryKeys) {
    throw new CodeGenerationValidationError(
      `Code generation config at ${configPath} has no \`dictionaryKeys\` block.`
    );
  }

  const { dictionaryKeys } = config;
  const fetched = await invokeFetcherWithTimeout(
    dictionaryKeys.fetchDictionaryKeys,
    dictionaryKeys.timeout ?? DEFAULT_TIMEOUT_MS
  );

  validateKeyCharset(fetched);
  const entries = dedupeAndSort(fetched, onWarn);

  if (entries.length === 0) {
    onWarn(
      "`fetchDictionaryKeys` returned no entries; the generated file will declare `DictionaryKey = never`."
    );
  }

  const outputPath = resolveOutputPath(projectDir, output ?? dictionaryKeys.output ?? DEFAULT_OUTPUT);
  const rendered = renderDictionaryKeysFile(entries, {
    configFile: relative(projectDir, configPath),
    augmentTarget
  });
  const existing = await readExistingFile(outputPath);
  const changed = existing !== rendered;

  if (changed && !check) {
    await rejectIfSymlink(outputPath);
    await atomicWrite(outputPath, rendered);
  }

  return {
    outputPath,
    keyCount: entries.length,
    changed
  };
}

async function invokeFetcherWithTimeout(
  fetcher: DictionaryKeysConfig["fetchDictionaryKeys"],
  timeoutMs: number
): Promise<readonly DictionaryKeyEntry[]> {
  if (timeoutMs <= 0) {
    return await fetcher();
  }

  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      fetcher(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`fetchDictionaryKeys timed out after ${timeoutMs}ms.`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function validateKeyCharset(entries: readonly DictionaryKeyEntry[]): void {
  for (const entry of entries) {
    if (typeof entry.key !== "string" || !KEY_CHARSET_PATTERN.test(entry.key)) {
      throw new CodeGenerationValidationError(
        `Invalid dictionary key ${JSON.stringify(entry.key)}. `
        + `Keys must match ${KEY_CHARSET_PATTERN} (${KEY_CHARSET_DESCRIPTION}).`
      );
    }
  }
}

function dedupeAndSort(
  entries: readonly DictionaryKeyEntry[],
  onWarn: (message: string) => void
): DictionaryKeyEntry[] {
  const map = new Map<string, DictionaryKeyEntry>();

  for (const entry of entries) {
    const existing = map.get(entry.key);

    if (!existing) {
      map.set(entry.key, entry);
      continue;
    }

    if (existing.comment !== entry.comment) {
      onWarn(
        `Duplicate dictionary key "${entry.key}" with conflicting comments; keeping the first occurrence.`
      );
    }
  }

  // Code-point ordering: deterministic across platforms and Node ICU variants
  // (small-icu / full-icu / no-icu). The key charset is ASCII so locale-aware
  // ordering would not produce different results, just less predictable ones.
  return [...map.values()].toSorted((a, b) => {
    if (a.key < b.key) {
      return -1;
    }

    if (a.key > b.key) {
      return 1;
    }

    return 0;
  });
}

function resolveOutputPath(projectDir: string, outputRelative: string): string {
  if (isAbsolute(outputRelative)) {
    throw new CodeGenerationValidationError(
      `Output path must be relative to project root; absolute paths are rejected: ${outputRelative}`
    );
  }

  const resolved = resolve(projectDir, outputRelative);
  const rel = relative(projectDir, resolved);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new CodeGenerationValidationError(
      `Output path escapes project root: ${outputRelative}. Must stay within ${projectDir}.`
    );
  }

  return resolved;
}

async function rejectIfSymlink(path: string): Promise<void> {
  let stats;

  try {
    stats = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw error;
  }

  if (stats.isSymbolicLink()) {
    throw new CodeGenerationValidationError(
      `Refusing to overwrite symlink at output path: ${path}. `
      + "Delete the symlink and rerun generation if this is intentional."
    );
  }
}

async function readExistingFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

/**
 * Atomic write via `O_EXCL` tmp file + `rename`. On POSIX adds `O_NOFOLLOW`
 * so a symlink swapped in after the prior `rejectIfSymlink` check still
 * cannot redirect the write to an attacker-controlled path.
 *
 * Tmp file is created with mode 0o600 so other users on a shared dev/CI host
 * cannot read the pre-rename window; after rename the final file is chmod'd
 * to 0o644 so editors and source-control tools (running as the same user)
 * see the standard source-file perms.
 */
async function atomicWrite(outputPath: string, content: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const suffix = randomBytes(6).toString("hex");
  const tmpPath = `${outputPath}.${suffix}.tmp`;

  const noFollow = (constants as Record<string, number | undefined>).O_NOFOLLOW ?? 0;
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;

  const handle = await open(tmpPath, flags, 0o600);

  try {
    await handle.writeFile(content, "utf-8");
  } finally {
    await handle.close();
  }

  try {
    await rename(tmpPath, outputPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {
      // best-effort cleanup; the rename failure is the meaningful error
    });
    throw error;
  }

  await chmod(outputPath, 0o644);
}
