import path from "node:path";
import process from "node:process";

import { execa } from "execa";
import fs from "fs-extra";

const UNPUBLISH_ORDER = [
  "starter",
  "dev",
  "components",
  "hooks",
  "core",
  "shared"
];

interface PackageJson {
  name: string;
  version: string;
}

interface UnpublishResult {
  name: string;
  version: string;
  success: boolean;
}

async function readPackageJson(pkgDir: string): Promise<PackageJson> {
  const pkgPath = path.join(pkgDir, "package.json");

  return await fs.readJson(pkgPath, "utf-8") as PackageJson;
}

async function unpublishPackage(name: string, version: string): Promise<boolean> {
  const pkgSpec = `${name}@${version}`;
  console.log(`\n📦 Unpublishing ${pkgSpec}...`);

  try {
    await execa({
      preferLocal: true,
      stdout: "inherit",
      stderr: "inherit"
    })`pnpm unpublish ${pkgSpec} --force`;

    console.log(`✅ Successfully unpublished ${pkgSpec}`);

    return true;
  } catch (error) {
    console.error(`❌ Failed to unpublish ${pkgSpec}`);

    if (error instanceof Error) {
      if (error.message.includes("E404")) {
        console.log(`   Package not found in registry, skipping...`);

        return true;
      }

      if (error.message.includes("E405")) {
        console.log(`   Package cannot be unpublished (has dependents or >72h old)`);
        console.log(`   Consider using: pnpm deprecate "${pkgSpec}" "deprecated"`);
      }
    }

    return false;
  }
}

async function main() {
  const cwd = process.cwd();
  const packagesDir = path.join(cwd, "packages");

  console.log("🚀 Starting unpublish process...");
  console.log(`📁 Packages directory: ${packagesDir}`);
  console.log(`📋 Unpublish order: ${UNPUBLISH_ORDER.join(" → ")}`);

  const results: UnpublishResult[] = [];

  for (const pkgName of UNPUBLISH_ORDER) {
    const pkgDir = path.join(packagesDir, pkgName);

    if (!fs.existsSync(pkgDir)) {
      console.log(`\n⚠️  Package directory not found: ${pkgName}, skipping...`);
      continue;
    }

    const {
      name,
      version
    } = await readPackageJson(pkgDir);
    const success = await unpublishPackage(name, version);
    results.push({
      name,
      version,
      success
    });
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 Unpublish Summary:");
  console.log("=".repeat(50));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    console.log("\n✅ Successfully unpublished:");

    for (const r of successful) {
      console.log(`   - ${r.name}@${r.version}`);
    }
  }

  if (failed.length > 0) {
    console.log("\n❌ Failed to unpublish:");

    for (const r of failed) {
      console.log(`   - ${r.name}@${r.version}`);
    }

    console.log("\n💡 Tip: For packages that cannot be unpublished, use deprecate:");

    for (const r of failed) {
      console.log(`   pnpm deprecate "${r.name}@${r.version}" "deprecated"`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
}

await main();
