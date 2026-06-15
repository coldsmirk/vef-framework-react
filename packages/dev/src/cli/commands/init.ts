import { resolve } from "node:path";
import process, { exit } from "node:process";

import consola from "consola";
import { execa } from "execa";
import fsExtra from "fs-extra";
import ora from "ora";
import prompts from "prompts";

import { FRAMEWORK_PACKAGE_SCOPE } from "../constants";
import { CliError, ensurePnpm, readPackageVersion } from "../utils";

const {
  copy,
  exists,
  move,
  readdir,
  readFile,
  readJson,
  writeFile,
  writeJson
} = fsExtra;

// Default dev API base URL — offered as the prompt default and used when `--api-url` is omitted.
const DEFAULT_DEV_API_URL = "http://127.0.0.1:8080";

export interface InitOptions {
  name?: string;
  title?: string;
  apiUrl?: string;
}

interface ScaffoldManifest {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Normalize raw user input into a valid npm package name (lowercase, hyphen-separated, URL-safe),
 * mirroring create-vite's `toValidPackageName`.
 */
export function toValidPackageName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "-")
    .replace(/^[._]+/, "")
    .replaceAll(/[^a-z0-9~-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

// Reject names that would let the scaffold escape the working directory: a single directory segment
// (no separators, no `..`) is required. The npm package name is derived separately via toValidPackageName.
function validateAppName(value: unknown): true | string {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    return "App name is required";
  }

  if (/[/\\]/.test(trimmed) || trimmed.includes("..")) {
    return "App name cannot contain path separators or '..'";
  }

  return true;
}

// Rewrite every framework dependency range to the running CLI's exact version, so a freshly
// scaffolded app pins the framework release that generated it rather than the template's eventually
// stale hardcoded range. `vef update` bumps them later.
export function pinFrameworkDependencies(packageJson: ScaffoldManifest, version: string): void {
  for (const field of ["dependencies", "devDependencies"] as const) {
    const deps = packageJson[field];

    if (!deps) {
      continue;
    }

    for (const name of Object.keys(deps)) {
      if (name.startsWith(FRAMEWORK_PACKAGE_SCOPE)) {
        deps[name] = version;
      }
    }
  }
}

/**
 * Replace a single `KEY=...` line (anchored to the exact key) in dotenv content. The value is applied
 * via a replacer function so `$` sequences in it are written literally, not as replacement patterns.
 */
export function setEnvVar(content: string, key: string, value: string): string {
  return content.replace(new RegExp(`^${key}=.*$`, "m"), () => `${key}=${value}`);
}

export async function handleInit(options: InitOptions = {}, cwd: string = process.cwd()): Promise<void> {
  consola.start("Creating a new VEF project");

  // Prompt only for values not supplied via the positional arg / flags, so
  // `vef init my-app --title "My App" --api-url https://api.example.com` runs without interaction.
  const questions: prompts.PromptObject[] = [];

  if (options.name === undefined) {
    questions.push({
      type: "text",
      name: "name",
      message: "What is the name of your app?",
      validate: validateAppName
    });
  }

  if (options.title === undefined) {
    questions.push({
      type: "text",
      name: "title",
      message: "What is the title of your app?",
      validate: value => (typeof value === "string" && value.trim().length > 0) || "App title is required"
    });
  }

  if (options.apiUrl === undefined) {
    questions.push({
      type: "text",
      name: "apiUrl",
      message: "Dev API base URL?",
      initial: DEFAULT_DEV_API_URL
    });
  }

  const answers = await prompts(questions, {
    // prompts resolves with the answered fields omitted on cancel; treat Ctrl+C / Esc as a clean exit.
    onCancel: () => {
      consola.info("Operation cancelled");
      exit(0);
    }
  });

  const rawName = options.name ?? answers.name;
  const nameError = validateAppName(rawName);

  if (nameError !== true) {
    throw new CliError(nameError);
  }

  const dirName = (rawName as string).trim();
  const packageName = toValidPackageName(dirName);
  const appTitle = ((options.title ?? answers.title) as string | undefined)?.trim() || dirName;
  const apiUrl = ((options.apiUrl ?? answers.apiUrl) as string | undefined)?.trim() || DEFAULT_DEV_API_URL;
  const appDir = resolve(cwd, dirName);

  // Guard before any write: refuse a non-empty target so a mistyped or re-run `init` can never clobber
  // an existing project. A pre-created empty directory is fine.
  if (await exists(appDir)) {
    const entries = await readdir(appDir);

    if (entries.length > 0) {
      throw new CliError(`Target directory "${dirName}" already exists and is not empty. Choose another name or empty it first.`);
    }
  }

  await ensurePnpm();
  await copyTemplateFiles(appDir);
  await updatePackageJson(packageName, appDir);
  await configureEnvFiles(appDir, {
    packageName,
    appTitle,
    apiUrl
  });
  await initializeGitRepository(appDir);
  await installDependencies(appDir);

  printSuccessMessage(dirName);
}

// Every config / dotfile the template ships is stored under a `_` prefix so the host monorepo never
// treats it as its own while the template lives inside the repo: npm strips a real `.gitignore` from
// the published tarball; ESLint / stylelint auto-discover and load a real config (the template's
// imports the built framework and crashes under jiti); and `.editorconfig` / `.gitattributes` would
// otherwise apply to the repo's own files in this subtree. `vef init` restores their real names.
const PREFIXED_TEMPLATE_FILES = [
  ["_gitignore", ".gitignore"],
  ["_gitattributes", ".gitattributes"],
  ["_editorconfig", ".editorconfig"],
  ["_package.json", "package.json"],
  ["_tsconfig.json", "tsconfig.json"],
  ["_eslint.config.ts", "eslint.config.ts"],
  ["_stylelint.config.js", "stylelint.config.js"],
  ["_commitlint.config.ts", "commitlint.config.ts"],
  ["_vite.config.ts", "vite.config.ts"]
] as const;

async function copyTemplateFiles(appDir: string): Promise<void> {
  const templateDir = resolve(import.meta.dirname, "../template");

  await copy(templateDir, appDir);
  consola.success("Successfully copied template files");

  for (const [prefixed, real] of PREFIXED_TEMPLATE_FILES) {
    await move(resolve(appDir, prefixed), resolve(appDir, real));
  }
}

async function updatePackageJson(packageName: string, appDir: string): Promise<void> {
  const packageJsonPath = resolve(appDir, "package.json");
  const packageJson: ScaffoldManifest = await readJson(packageJsonPath, { encoding: "utf-8" });
  const version = readPackageVersion();

  packageJson.name = packageName;
  pinFrameworkDependencies(packageJson, version);

  await writeJson(packageJsonPath, packageJson, { encoding: "utf-8", spaces: 2 });
  consola.success(`Successfully set the app name and pinned framework packages to v${version}`);
}

async function configureEnvFiles(
  appDir: string,
  values: { packageName: string; appTitle: string; apiUrl: string }
): Promise<void> {
  const envPath = resolve(appDir, "env/.env");
  const env = await readFile(envPath, { encoding: "utf-8" });
  const updatedEnv = setEnvVar(setEnvVar(env, "VEF_APP_NAME", values.packageName), "VEF_APP_TITLE", values.appTitle);
  await writeFile(envPath, updatedEnv);

  const devEnvPath = resolve(appDir, "env/.env.development");
  const devEnv = await readFile(devEnvPath, { encoding: "utf-8" });
  await writeFile(devEnvPath, setEnvVar(devEnv, "VEF_APP_API_BASE_URL", values.apiUrl));

  consola.success("Successfully configured environment files");
}

async function initializeGitRepository(appDir: string): Promise<void> {
  const spinner = ora("Initializing git repository...").start();

  try {
    await execa`git --version`;
    await execa({ cwd: appDir })`git init`;
    spinner.succeed("Successfully initialized git repository");
  } catch (error) {
    spinner.fail("Failed to initialize git repository");
    throw error;
  }
}

async function installDependencies(appDir: string): Promise<void> {
  const spinner = ora("Installing dependencies...").start();

  try {
    await execa({ cwd: appDir })("pnpm", ["install"]);
    spinner.succeed("Successfully installed dependencies");
  } catch (error) {
    spinner.fail("Failed to install dependencies");
    throw error;
  }
}

function printSuccessMessage(dirName: string): void {
  consola.success("VEF project created successfully!");
  consola.box(`Next steps:\n\n  cd ${dirName}\n  pnpm dev`);
}
