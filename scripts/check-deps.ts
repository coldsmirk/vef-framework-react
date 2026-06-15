/**
 * Dependency audit & safe-upgrade advisor.
 *
 * pnpm deps:check                          # dry-run report
 * pnpm deps:check --apply                  # also upgrade safe patch/minor
 * pnpm deps:check --release-age 24         # shorter cooldown window
 * pnpm deps:check --no-cooldown            # disable cooldown filter
 * pnpm deps:check --ci                     # non-zero exit on issues
 * pnpm deps:check --severity high          # only show >= high in tables
 *
 * Data sources:
 * - pnpm audit (lockfile-aware, npm advisory DB)
 * - pnpm outdated (candidate upgrades)
 * - OSV.dev /v1/querybatch (cross-check, OSV-only advisories)
 * - registry.npmjs.org (publish time + deprecation status)
 * - GitHub Advisory REST (optional CVSS/references enrichment)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import chalk from "chalk";
import { consola } from "consola";
import { execa } from "execa";
import { globby } from "globby";

// ============================================================
// Types
// ============================================================

type Severity = "critical" | "high" | "moderate" | "low" | "unknown";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  low: 1,
  unknown: 0
};

interface CliOptions {
  apply: boolean;
  releaseAgeHours: number;
  cooldown: boolean;
  ci: boolean;
  minSeverity: Severity;
  writeReport: boolean;
  allowDirty: boolean;
  help: boolean;
}

interface PnpmAuditAdvisory {
  id: number;
  title: string;
  module_name: string;
  vulnerable_versions: string;
  patched_versions: string;
  severity: Severity;
  cwe?: string | string[];
  github_advisory_id?: string;
  url: string;
  findings: Array<{ version: string; paths: string[]; dev?: boolean }>;
}

interface PnpmAuditOutput {
  advisories: Record<string, PnpmAuditAdvisory>;
}

interface PnpmOutdatedEntry {
  current: string;
  latest: string;
  wanted: string;
  isDeprecated: boolean;
  dependencyType: string;
}

type PnpmOutdatedOutput = Record<string, PnpmOutdatedEntry>;

interface OsvVulnRef {
  id: string;
  modified: string;
}

interface OsvDetail {
  id: string;
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{
    package?: { name?: string; ecosystem?: string };
    ranges?: Array<{ type: string; events: Array<{ introduced?: string; fixed?: string }> }>;
    versions?: string[];
  }>;
  references?: Array<{ type: string; url: string }>;
  aliases?: string[];
  database_specific?: { cwe_ids?: string[]; severity?: string };
}

interface Advisory {
  id: string;
  title: string;
  severity: Severity;
  cvss?: number;
  patchedRange: string;
  vulnerableRange: string;
  url: string;
  source: "pnpm-audit" | "osv";
}

interface NpmPackageMeta {
  versions: string[];
  time: Record<string, string>;
  deprecated: Record<string, string>;
}

type Classification
  = | "ok"
    | "safe-patch"
    | "safe-minor"
    | "requires-major"
    | "held-by-cooldown"
    | "deprecated"
    | "vulnerable-fix-available"
    | "vulnerable-no-fix";

interface PackageReport {
  name: string;
  current: string;
  affectedPaths: string[];
  vulnerabilities: Advisory[];
  candidate?: {
    version: string;
    releasedAt?: string;
    semverBump: SemverBump;
    cooldownRemainingHours?: number;
  };
  deprecated?: string;
  classification: Classification;
  recommendedAction: string;
}

type SemverBump = "patch" | "minor" | "major" | "prerelease" | "invalid";

interface ClassifyInput {
  current: string;
  candidate: string | undefined;
  releasedAt: string | undefined;
  releaseAgeHours: number;
  cooldown: boolean;
  vulns: Advisory[];
  deprecated?: string;
}

interface ClassifyResult {
  classification: Classification;
  bump: SemverBump;
  cooldownRemainingH?: number;
  action: string;
}

// ============================================================
// CLI
// ============================================================

function parseCli(): CliOptions {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      "release-age": { type: "string", default: "72" },
      "no-cooldown": { type: "boolean", default: false },
      ci: { type: "boolean", default: false },
      severity: { type: "string", default: "low" },
      "no-report": { type: "boolean", default: false },
      "allow-dirty": { type: "boolean", default: false },
      help: {
        type: "boolean",
        short: "h",
        default: false
      }
    },
    strict: true,
    allowPositionals: false
  });

  const releaseAge = Number.parseFloat(values["release-age"] as string);

  if (!Number.isFinite(releaseAge) || releaseAge < 0) {
    consola.error(`Invalid --release-age: ${values["release-age"]}`);
    process.exitCode = 2;
    throw new Error("Invalid CLI arguments");
  }

  const sev = String(values.severity).toLowerCase() as Severity;

  if (!(sev in SEVERITY_RANK)) {
    consola.error(`Invalid --severity: ${values.severity}. Use low|moderate|high|critical.`);
    process.exitCode = 2;
    throw new Error("Invalid CLI arguments");
  }

  return {
    apply: values.apply as boolean,
    releaseAgeHours: releaseAge,
    cooldown: !(values["no-cooldown"] as boolean),
    ci: values.ci as boolean,
    minSeverity: sev,
    writeReport: !(values["no-report"] as boolean),
    allowDirty: values["allow-dirty"] as boolean,
    help: values.help as boolean
  };
}

function printHelp(): void {
  console.log(`
Usage: pnpm deps:check [options]

Options:
  --apply                Upgrade safe patch/minor versions via "pnpm -r up <pkg>@<ver>".
                         Refuses to run when the working tree is dirty (use --allow-dirty to override).
                         Major bumps are NEVER auto-applied.
  --release-age <hours>  Cooldown threshold in hours. Default: 72. Candidates younger than this
                         are flagged "held-by-cooldown" and excluded from --apply.
  --no-cooldown          Disable the cooldown filter entirely.
  --ci                   Exit with code 1 when vulnerabilities or upgrades are found.
  --severity <level>     Minimum severity to display: low|moderate|high|critical. Default: low.
  --no-report            Skip writing the Markdown report under docs/security/.
  --allow-dirty          Allow --apply even when the git working tree is dirty.
  -h, --help             Show this message.
`);
}

// ============================================================
// pnpm helpers
// ============================================================

async function runPnpmAudit(): Promise<PnpmAuditOutput> {
  const { stdout } = await execa("pnpm", ["audit", "--json"], { reject: false });

  if (stdout.trim().length === 0) {
    return { advisories: {} };
  }

  try {
    const parsed = JSON.parse(stdout);
    return { advisories: parsed.advisories ?? {} };
  } catch (error) {
    consola.warn(`Failed to parse pnpm audit JSON: ${(error as Error).message}`);
    return { advisories: {} };
  }
}

async function runPnpmOutdated(): Promise<PnpmOutdatedOutput> {
  const { stdout } = await execa(
    "pnpm",
    ["outdated", "--recursive", "--format", "json"],
    { reject: false }
  );

  if (stdout.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(stdout) as PnpmOutdatedOutput;
  } catch (error) {
    consola.warn(`Failed to parse pnpm outdated JSON: ${(error as Error).message}`);
    return {};
  }
}

async function isGitClean(): Promise<boolean> {
  try {
    const { stdout } = await execa("git", ["status", "--porcelain"]);
    return stdout.trim() === "";
  } catch {
    return true;
  }
}

/**
 * Walk every workspace package.json and collect direct dependency names from all
 * dependency sections. Used to split apply targets into "direct" (safe to run
 * `pnpm up` against) vs "transitive" (requires pnpm-workspace.yaml overrides instead).
 */
async function loadDirectDeps(): Promise<Set<string>> {
  const files = await globby(
    ["package.json", "*/package.json", "packages/*/package.json"],
    {
      cwd: process.cwd(),
      absolute: true,
      ignore: ["**/node_modules/**"]
    }
  );
  const result = new Set<string>();
  const sections = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ] as const;

  for (const f of files) {
    const text = await readFile(f, "utf-8");
    const pkg = JSON.parse(text) as Record<string, Record<string, string> | undefined>;

    for (const section of sections) {
      for (const dep of Object.keys(pkg[section] ?? {})) {
        result.add(dep);
      }
    }
  }

  return result;
}

// ============================================================
// External data sources
// ============================================================

async function fetchJsonSafe<T>(url: string, init?: RequestInit, label = url): Promise<T | null> {
  try {
    const res = await fetch(url, init);

    if (!res.ok) {
      consola.debug(`${label} -> HTTP ${res.status}`);
      return null;
    }

    return await res.json() as T;
  } catch (error) {
    consola.debug(`${label} -> ${(error as Error).message}`);
    return null;
  }
}

async function queryOsvBatch(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, OsvVulnRef[]>> {
  const result = new Map<string, OsvVulnRef[]>();

  if (packages.length === 0) {
    return result;
  }

  const BATCH = 50;
  const CONCURRENCY = 5;
  const batches: Array<typeof packages> = [];

  for (let i = 0; i < packages.length; i += BATCH) {
    batches.push(packages.slice(i, i + BATCH));
  }

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
      while (cursor < batches.length) {
        const idx = cursor++;
        const batch = batches[idx];

        if (!batch) {
          continue;
        }

        const body = {
          queries: batch.map(p => {
            return {
              package: { name: p.name, ecosystem: "npm" },
              version: p.version
            };
          })
        };
        const res = await fetchJsonSafe<{ results: Array<{ vulns?: OsvVulnRef[] }> }>(
          "https://api.osv.dev/v1/querybatch",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body)
          },
          `OSV batch ${idx}`
        );

        if (!res?.results) {
          continue;
        }

        for (const [i, r] of res.results.entries()) {
          const pkg = batch[i];

          if (!pkg) {
            continue;
          }

          const vulns = r.vulns ?? [];

          if (vulns.length > 0) {
            result.set(`${pkg.name}@${pkg.version}`, vulns);
          }
        }
      }
    })
  );

  return result;
}

function fetchOsvDetail(id: string): Promise<OsvDetail | null> {
  return fetchJsonSafe<OsvDetail>(
    `https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`,
    undefined,
    `OSV ${id}`
  );
}

async function getGithubToken(): Promise<string | null> {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  try {
    const { stdout } = await execa("gh", ["auth", "token"], { reject: false });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function fetchGhsa(id: string, token: string): Promise<{ cvss?: number; references?: string[] } | null> {
  const raw = await fetchJsonSafe<{
    cvss?: { score?: number };
    references?: Array<{ url?: string } | string>;
  }>(
    `https://api.github.com/advisories/${encodeURIComponent(id)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    },
    `GHSA ${id}`
  );

  if (!raw) {
    return null;
  }

  return {
    cvss: raw.cvss?.score,
    references: (raw.references ?? [])
      .map(x => typeof x === "string" ? x : x.url ?? "")
      .filter(Boolean)
  };
}

async function fetchNpmMeta(name: string): Promise<NpmPackageMeta | null> {
  const data = await fetchJsonSafe<{
    time?: Record<string, string>;
    versions?: Record<string, { deprecated?: string }>;
    "dist-tags"?: { latest?: string };
  }>(
    `https://registry.npmjs.org/${name.replace("/", "%2F")}`,
    undefined,
    `npm ${name}`
  );

  if (!data) {
    return null;
  }

  const deprecated: Record<string, string> = {};

  for (const [v, info] of Object.entries(data.versions ?? {})) {
    if (info?.deprecated) {
      deprecated[v] = info.deprecated;
    }
  }

  return {
    versions: Object.keys(data.versions ?? {}),
    time: data.time ?? {},
    deprecated
  };
}

// ============================================================
// Semver helpers (lightweight, no dependency)
// ============================================================

interface Semver {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

function parseSemver(v: string): Semver | null {
  const m = v.match(/^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<prerelease>[\w.+-]+))?/);

  if (!m?.groups) {
    return null;
  }

  return {
    major: Number(m.groups.major),
    minor: Number(m.groups.minor),
    patch: Number(m.groups.patch),
    prerelease: m.groups.prerelease
  };
}

function semverBump(from: string, to: string): SemverBump {
  const a = parseSemver(from);
  const b = parseSemver(to);

  if (!a || !b) {
    return "invalid";
  }

  if (a.major !== b.major) {
    return "major";
  }

  if (a.minor !== b.minor) {
    return "minor";
  }

  if (a.patch !== b.patch) {
    return "patch";
  }

  // Same numeric (major.minor.patch) but different prerelease tag (e.g. dev snapshots).
  if (a.prerelease !== b.prerelease) {
    return "prerelease";
  }

  return "patch";
}

function cmpSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);

  if (!pa || !pb) {
    return a.localeCompare(b);
  }

  if (pa.major !== pb.major) {
    return pa.major - pb.major;
  }

  if (pa.minor !== pb.minor) {
    return pa.minor - pb.minor;
  }

  if (pa.patch !== pb.patch) {
    return pa.patch - pb.patch;
  }

  // Per semver, a release > any prerelease with the same numeric prefix.
  if (!pa.prerelease && pb.prerelease) {
    return 1;
  }

  if (pa.prerelease && !pb.prerelease) {
    return -1;
  }

  if (pa.prerelease && pb.prerelease) {
    return pa.prerelease.localeCompare(pb.prerelease);
  }

  return 0;
}

type Op = ">=" | ">" | "<" | "<=";

function checkConstraint(diff: number, op: Op): boolean {
  switch (op) {
    case ">=": { return diff >= 0; }
    case ">": { return diff > 0; }
    case "<=": { return diff <= 0; }
    case "<": { return diff < 0; }
  }
}

/**
 * Pick the lowest version > current that satisfies a "patched range".
 * Returns null if no available version satisfies the range.
 */
function pickPatchedVersion(
  patchedRange: string,
  available: string[],
  current: string
): string | null {
  if (available.length === 0) {
    return null;
  }

  const constraints: Array<{ op: Op; ver: string }> = [];
  const re = /(?<op>>=|<=|>|<)\s*(?<ver>\d+\.\d+\.\d[\w.+-]*)/g;

  for (const match of patchedRange.matchAll(re)) {
    const op = match.groups?.op as Op | undefined;
    const ver = match.groups?.ver;

    if (op && ver) {
      constraints.push({ op, ver });
    }
  }

  // Without any parseable constraint, we cannot tell which versions are actually patched.
  // Returning the lowest "newer" version would be a guess and could falsely flag arbitrary
  // upgrades as the fix — refuse to recommend in that case.
  if (constraints.length === 0) {
    return null;
  }

  const sorted = available.toSorted(cmpSemver);

  for (const v of sorted) {
    if (cmpSemver(v, current) <= 0) {
      continue;
    }

    const ok = constraints.every(c => checkConstraint(cmpSemver(v, c.ver), c.op));

    if (ok) {
      return v;
    }
  }

  return null;
}

// ============================================================
// Classification
// ============================================================

function pickSeverity(advisories: Advisory[]): Severity {
  let best: Severity = "unknown";

  for (const a of advisories) {
    if (SEVERITY_RANK[a.severity] > SEVERITY_RANK[best]) {
      best = a.severity;
    }
  }

  return best;
}

function computeCooldown(
  candidate: string | undefined,
  releasedAt: string | undefined,
  cooldown: boolean,
  releaseAgeHours: number
): { held: boolean; remainingH?: number } {
  if (!candidate || !releasedAt || !cooldown) {
    return { held: false };
  }

  const releasedMs = Date.parse(releasedAt);

  if (!Number.isFinite(releasedMs)) {
    return { held: false };
  }

  const ageH = (Date.now() - releasedMs) / 3_600_000;

  if (ageH >= releaseAgeHours) {
    return { held: false };
  }

  return { held: true, remainingH: Math.max(0, releaseAgeHours - ageH) };
}

function classify(input: ClassifyInput): ClassifyResult {
  const {
    current,
    candidate,
    releasedAt,
    releaseAgeHours,
    cooldown,
    vulns,
    deprecated
  } = input;
  const bump = candidate ? semverBump(current, candidate) : "invalid";
  const hasVulns = vulns.length > 0;
  const { held, remainingH } = computeCooldown(candidate, releasedAt, cooldown, releaseAgeHours);

  if (hasVulns) {
    if (!candidate || bump === "invalid") {
      return {
        classification: "vulnerable-no-fix",
        bump,
        action: "🚨 No fix available. Pin via pnpm-workspace.yaml overrides if exposure matters."
      };
    }

    if (held) {
      return {
        classification: "held-by-cooldown",
        bump,
        cooldownRemainingH: remainingH,
        action: `⏳ Fix exists (${candidate}) but in cooldown. Apply after ${remainingH!.toFixed(0)}h.`
      };
    }

    return {
      classification: "vulnerable-fix-available",
      bump,
      action: bump === "major" || bump === "prerelease"
        ? `🛡 Fix requires ${bump} bump → ${candidate}. Manual review.`
        : `🛡 Upgrade to ${candidate} (${bump}).`
    };
  }

  if (deprecated) {
    return {
      classification: "deprecated",
      bump,
      action: `⚠ Deprecated: ${deprecated.slice(0, 80)}`
    };
  }

  if (!candidate || bump === "invalid") {
    return {
      classification: "ok",
      bump,
      action: ""
    };
  }

  if (held) {
    return {
      classification: "held-by-cooldown",
      bump,
      cooldownRemainingH: remainingH,
      action: `⏳ Cooldown: candidate ${candidate} is younger than ${releaseAgeHours}h.`
    };
  }

  if (bump === "major" || bump === "prerelease") {
    return {
      classification: "requires-major",
      bump,
      action: bump === "prerelease"
        ? `🧪 Prerelease bump → ${candidate}. Manual review (dev snapshots are never auto-applied).`
        : `📦 Major upgrade available → ${candidate}. Manual review.`
    };
  }

  return {
    classification: bump === "minor" ? "safe-minor" : "safe-patch",
    bump,
    action: `✅ Safe upgrade → ${candidate} (${bump}).`
  };
}

// ============================================================
// Orchestration
// ============================================================

interface AdvisoryEnv {
  /**
   * key: name@version
   */
  byPackage: Map<string, Advisory[]>;
  /**
   * key: name@version → dependency paths from pnpm audit findings
   */
  affectedPaths: Map<string, string[]>;
}

function ingestPnpmAudit(audit: PnpmAuditOutput): AdvisoryEnv {
  const byPackage = new Map<string, Advisory[]>();
  const affectedPaths = new Map<string, string[]>();

  for (const a of Object.values(audit.advisories)) {
    const advisory: Advisory = {
      id: a.github_advisory_id ?? `npm-${a.id}`,
      title: a.title,
      severity: (a.severity ?? "unknown") as Severity,
      patchedRange: a.patched_versions ?? "",
      vulnerableRange: a.vulnerable_versions ?? "",
      url: a.url ?? "",
      source: "pnpm-audit"
    };

    for (const finding of a.findings) {
      const key = `${a.module_name}@${finding.version}`;
      const arr = byPackage.get(key) ?? [];

      if (!arr.some(x => x.id === advisory.id)) {
        arr.push(advisory);
      }

      byPackage.set(key, arr);

      const paths = affectedPaths.get(key) ?? [];

      for (const p of finding.paths) {
        if (!paths.includes(p)) {
          paths.push(p);
        }
      }

      affectedPaths.set(key, paths);
    }
  }

  return { byPackage, affectedPaths };
}

async function crossCheckWithOsv(env: AdvisoryEnv): Promise<void> {
  const targets: Array<{ name: string; version: string }> = [];

  for (const key of env.byPackage.keys()) {
    const at = key.lastIndexOf("@");

    if (at <= 0) {
      continue;
    }

    targets.push({ name: key.slice(0, at), version: key.slice(at + 1) });
  }

  if (targets.length === 0) {
    return;
  }

  const osvHits = await queryOsvBatch(targets);

  if (osvHits.size === 0) {
    return;
  }

  const allIds = new Set<string>();

  for (const refs of osvHits.values()) {
    for (const r of refs) {
      allIds.add(r.id);
    }
  }

  const details = new Map<string, OsvDetail>();
  await Promise.all(
    [...allIds].map(async id => {
      const d = await fetchOsvDetail(id);

      if (d) {
        details.set(id, d);
      }
    })
  );

  for (const [key, refs] of osvHits) {
    const existing = env.byPackage.get(key) ?? [];

    for (const ref of refs) {
      const detail = details.get(ref.id);

      if (!detail) {
        continue;
      }

      const ghsa = detail.aliases?.find(alias => alias.startsWith("GHSA-")) ?? ref.id;

      if (existing.some(x => x.id === ghsa || x.id === ref.id)) {
        continue;
      }

      const fixedVersions: string[] = [];

      for (const aff of detail.affected ?? []) {
        for (const range of aff.ranges ?? []) {
          for (const ev of range.events) {
            if (ev.fixed) {
              fixedVersions.push(ev.fixed);
            }
          }
        }
      }

      const sevText = detail.database_specific?.severity?.toLowerCase() as Severity | undefined;
      existing.push({
        id: ghsa,
        title: detail.summary ?? ref.id,
        severity: sevText && sevText in SEVERITY_RANK ? sevText : "unknown",
        patchedRange: fixedVersions.length > 0 ? `>=${fixedVersions[0]}` : "",
        vulnerableRange: "",
        url: `https://osv.dev/vulnerability/${ref.id}`,
        source: "osv"
      });
    }

    env.byPackage.set(key, existing);
  }
}

async function enrichWithGhsa(env: AdvisoryEnv): Promise<void> {
  const token = await getGithubToken();

  if (!token) {
    consola.info("No GITHUB_TOKEN found; skipping CVSS enrichment.");
    return;
  }

  const ghsaIds = new Set<string>();

  for (const list of env.byPackage.values()) {
    for (const a of list) {
      if (a.id.startsWith("GHSA-")) {
        ghsaIds.add(a.id);
      }
    }
  }

  const enrichments = new Map<string, { cvss?: number; references?: string[] }>();
  await Promise.all(
    [...ghsaIds].map(async id => {
      const data = await fetchGhsa(id, token);

      if (data) {
        enrichments.set(id, data);
      }
    })
  );

  for (const list of env.byPackage.values()) {
    for (const a of list) {
      const e = enrichments.get(a.id);

      if (e?.cvss !== undefined) {
        a.cvss = e.cvss;
      }
    }
  }
}

function pickCandidate(
  report: PackageReport,
  meta: NpmPackageMeta | null | undefined,
  outdatedEntry: PnpmOutdatedEntry | undefined
): string | undefined {
  let candidate: string | undefined;

  if (report.vulnerabilities.length > 0 && meta) {
    for (const adv of report.vulnerabilities) {
      if (!adv.patchedRange) {
        continue;
      }

      const v = pickPatchedVersion(adv.patchedRange, meta.versions, report.current);

      if (v && (!candidate || cmpSemver(v, candidate) > 0)) {
        candidate = v;
      }
    }
  }

  if (!candidate && outdatedEntry) {
    candidate = outdatedEntry.latest;
  }

  return candidate;
}

async function buildReports(
  env: AdvisoryEnv,
  outdated: PnpmOutdatedOutput,
  opts: CliOptions
): Promise<PackageReport[]> {
  const reports = new Map<string, PackageReport>();

  for (const [key, advisories] of env.byPackage) {
    const at = key.lastIndexOf("@");
    const name = key.slice(0, at);
    const version = key.slice(at + 1);

    if (!reports.has(key)) {
      reports.set(key, {
        name,
        current: version,
        affectedPaths: env.affectedPaths.get(key) ?? [],
        vulnerabilities: advisories,
        classification: "ok",
        recommendedAction: ""
      });
    }
  }

  for (const [name, info] of Object.entries(outdated)) {
    const key = `${name}@${info.current}`;

    if (reports.has(key)) {
      continue;
    }

    reports.set(key, {
      name,
      current: info.current,
      affectedPaths: [],
      vulnerabilities: [],
      classification: "ok",
      recommendedAction: ""
    });
  }

  const uniqueNames = new Set([...reports.values()].map(r => r.name));
  const metaCache = new Map<string, NpmPackageMeta | null>();
  await Promise.all(
    [...uniqueNames].map(async name => {
      metaCache.set(name, await fetchNpmMeta(name));
    })
  );

  for (const report of reports.values()) {
    const meta = metaCache.get(report.name);
    const outdatedEntry = outdated[report.name];
    const candidateVer = pickCandidate(report, meta, outdatedEntry);
    const releasedAt = candidateVer ? meta?.time[candidateVer] : undefined;
    const deprecated = meta?.deprecated[report.current];
    const result = classify({
      current: report.current,
      candidate: candidateVer,
      releasedAt,
      releaseAgeHours: opts.releaseAgeHours,
      cooldown: opts.cooldown,
      vulns: report.vulnerabilities,
      deprecated
    });

    report.candidate = candidateVer
      ? {
          version: candidateVer,
          releasedAt,
          semverBump: result.bump,
          cooldownRemainingHours: result.cooldownRemainingH
        }
      : undefined;
    report.deprecated = deprecated;
    report.classification = result.classification;
    report.recommendedAction = result.action;
  }

  return [...reports.values()].toSorted((a, b) => {
    const sa = pickSeverity(a.vulnerabilities);
    const sb = pickSeverity(b.vulnerabilities);

    if (sa !== sb) {
      return SEVERITY_RANK[sb] - SEVERITY_RANK[sa];
    }

    return a.name.localeCompare(b.name);
  });
}

// ============================================================
// Output
// ============================================================

function colorSeverity(s: Severity, hasVulns: boolean): string {
  if (!hasVulns) {
    return chalk.dim("—   ");
  }

  switch (s) {
    case "critical": { return chalk.bgRed.white.bold(" CRIT "); }
    case "high": { return chalk.red.bold("HIGH"); }
    case "moderate": { return chalk.yellow.bold("MOD "); }
    case "low": { return chalk.blue("LOW "); }
    default: { return chalk.gray("?   "); }
  }
}

function colorClassification(c: Classification): string {
  switch (c) {
    case "vulnerable-fix-available": { return chalk.green.bold("FIX-READY"); }
    case "vulnerable-no-fix": { return chalk.red.bold("NO-FIX"); }
    case "held-by-cooldown": { return chalk.yellow("COOLDOWN"); }
    case "deprecated": { return chalk.magenta("DEPRECATED"); }
    case "safe-patch": { return chalk.green("safe-patch"); }
    case "safe-minor": { return chalk.green("safe-minor"); }
    case "requires-major": { return chalk.cyan("major"); }
    default: { return chalk.gray("ok"); }
  }
}

interface Stats {
  vuln: number;
  safePatch: number;
  safeMinor: number;
  major: number;
  cooldown: number;
  deprecated: number;
}

function countByClassification(reports: PackageReport[]): Stats {
  const s: Stats = {
    vuln: 0,
    safePatch: 0,
    safeMinor: 0,
    major: 0,
    cooldown: 0,
    deprecated: 0
  };

  for (const r of reports) {
    if (r.vulnerabilities.length > 0) {
      s.vuln++;
    }

    switch (r.classification) {
      case "safe-patch": {
        s.safePatch++;
        break;
      }

      case "safe-minor": {
        s.safeMinor++;
        break;
      }

      case "requires-major": {
        s.major++;
        break;
      }

      case "held-by-cooldown": {
        s.cooldown++;
        break;
      }

      case "deprecated": {
        s.deprecated++;
        break;
      }

      default: {
        break;
      }
    }
  }

  return s;
}

function printTerminal(reports: PackageReport[], stats: Stats, opts: CliOptions): void {
  const filtered = reports.filter(r => {
    if (r.vulnerabilities.length > 0) {
      return SEVERITY_RANK[pickSeverity(r.vulnerabilities)] >= SEVERITY_RANK[opts.minSeverity];
    }

    return r.classification !== "ok";
  });

  console.log("");
  console.log(chalk.bold.underline("Dependency Audit"));
  console.log(
    `  ${chalk.red("vulnerable:")} ${stats.vuln}  `
    + `${chalk.green("safe-upgrade:")} ${stats.safePatch + stats.safeMinor} (patch ${stats.safePatch} + minor ${stats.safeMinor})  `
    + `${chalk.yellow("cooldown:")} ${stats.cooldown}  `
    + `${chalk.cyan("major:")} ${stats.major}  `
    + `${chalk.magenta("deprecated:")} ${stats.deprecated}`
  );
  console.log("");

  if (filtered.length === 0) {
    consola.success("No issues at or above severity threshold.");
    return;
  }

  const wPkg = Math.max(20, ...filtered.map(r => r.name.length)) + 2;
  const wCur = Math.max(8, ...filtered.map(r => r.current.length)) + 2;
  const wCand = Math.max(10, ...filtered.map(r => (r.candidate?.version ?? "—").length)) + 2;
  const wBump = Math.max(8, ...filtered.map(r => (r.candidate?.semverBump ?? "—").length)) + 2;

  console.log(
    chalk.dim(
      `  ${
        "PACKAGE".padEnd(wPkg)
      }${"CURRENT".padEnd(wCur)
      }${"CANDIDATE".padEnd(wCand)
      }${"BUMP".padEnd(wBump)
      }${"SEV".padEnd(8)
      }${"STATUS".padEnd(20)
      }NOTES`
    )
  );
  console.log(chalk.dim(`  ${"─".repeat(wPkg + wCur + wCand + wBump + 8 + 20 + 40)}`));

  for (const r of filtered) {
    const sev = pickSeverity(r.vulnerabilities);
    const cvssText = r.vulnerabilities[0]?.cvss === undefined ? "" : ` (CVSS ${r.vulnerabilities[0].cvss})`;
    console.log(
      `  ${
        r.name.padEnd(wPkg)
      }${r.current.padEnd(wCur)
      }${(r.candidate?.version ?? "—").padEnd(wCand)
      }${(r.candidate?.semverBump ?? "—").padEnd(wBump)
      }${colorSeverity(sev, r.vulnerabilities.length > 0)}  ${
        colorClassification(r.classification).padEnd(30)
      }${chalk.dim(r.recommendedAction + cvssText)}`
    );

    for (const v of r.vulnerabilities) {
      console.log(`    ${chalk.dim(`↳ ${v.id} ${v.title}  ${v.url}`)}`);
    }
  }

  console.log("");
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function asMarkdownTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return "_(none)_\n";
  }

  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(r => `| ${r.join(" | ")} |`)
  ];
  return `${lines.join("\n")}\n`;
}

function buildVulnRows(reports: PackageReport[]): string[][] {
  return reports
    .filter(r => r.vulnerabilities.length > 0)
    .flatMap(r => r.vulnerabilities.map(v => [
      r.name,
      r.current,
      `[${v.id}](${v.url})`,
      v.severity,
      v.cvss === undefined ? "—" : v.cvss.toFixed(1),
      r.candidate?.version ?? "—",
      r.candidate?.semverBump ?? "—",
      r.classification
    ]));
}

function buildSafeRows(reports: PackageReport[]): string[][] {
  return reports
    .filter(r => r.classification === "safe-patch" || r.classification === "safe-minor")
    .map(r => [
      r.name,
      r.current,
      r.candidate!.version,
      r.candidate!.semverBump,
      r.candidate!.releasedAt?.slice(0, 10) ?? "—"
    ]);
}

function buildCooldownRows(reports: PackageReport[]): string[][] {
  return reports
    .filter(r => r.classification === "held-by-cooldown")
    .map(r => [
      r.name,
      r.current,
      r.candidate?.version ?? "—",
      r.candidate?.releasedAt?.slice(0, 10) ?? "—",
      r.candidate?.cooldownRemainingHours === undefined
        ? "—"
        : `${r.candidate.cooldownRemainingHours.toFixed(0)}h`
    ]);
}

function buildMajorRows(reports: PackageReport[]): string[][] {
  return reports
    .filter(r => r.classification === "requires-major")
    .map(r => [r.name, r.current, r.candidate?.version ?? "—"]);
}

function buildDeprecatedRows(reports: PackageReport[]): string[][] {
  return reports
    .filter(r => r.deprecated !== undefined)
    .map(r => [r.name, r.current, r.deprecated!.slice(0, 120)]);
}

function buildOverridesBlock(reports: PackageReport[]): string {
  const overrides = reports.filter(r => {
    const sev = pickSeverity(r.vulnerabilities);
    return r.vulnerabilities.length > 0 && r.candidate && (sev === "high" || sev === "critical");
  });

  if (overrides.length === 0) {
    return "_(none — no high/critical vulnerabilities with a known patched version)_\n";
  }

  const inner = overrides.map(r => `  ${r.name}: "${r.candidate!.version}"`).join("\n");
  return `\`\`\`yaml\noverrides:\n${inner}\n\`\`\`\n`;
}

async function writeMarkdownReport(
  reports: PackageReport[],
  stats: Stats,
  opts: CliOptions
): Promise<string> {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const timeStr = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  const fileName = `deps-audit-${dateStr}-${timeStr}.md`;
  const dir = resolve(process.cwd(), "docs/security");
  await mkdir(dir, { recursive: true });

  const filePath = resolve(dir, fileName);

  const sections = [
    `# Dependency Audit — ${dateStr} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    "",
    `> Generated by \`scripts/check-deps.ts\`. Cooldown threshold: ${opts.cooldown ? `${opts.releaseAgeHours}h` : "disabled"}.`,
    "",
    "## Summary",
    "",
    `- Vulnerable packages: **${stats.vuln}**`,
    `- Safe upgrades: **${stats.safePatch + stats.safeMinor}** (patch ${stats.safePatch} + minor ${stats.safeMinor})`,
    `- Held by cooldown: **${stats.cooldown}**`,
    `- Major upgrades available: **${stats.major}**`,
    `- Deprecated packages: **${stats.deprecated}**`,
    "",
    "## Vulnerabilities",
    "",
    asMarkdownTable(
      ["Package", "Current", "Advisory", "Severity", "CVSS", "Fix", "Bump", "Status"],
      buildVulnRows(reports)
    ),
    "## Safe upgrades (`--apply` target)",
    "",
    asMarkdownTable(["Package", "Current", "Target", "Bump", "Released"], buildSafeRows(reports)),
    "## Held by cooldown",
    "",
    asMarkdownTable(["Package", "Current", "Candidate", "Released", "Remaining"], buildCooldownRows(reports)),
    "## Major upgrades (manual review)",
    "",
    asMarkdownTable(["Package", "Current", "Latest"], buildMajorRows(reports)),
    "## Deprecated packages",
    "",
    asMarkdownTable(["Package", "Version", "Message"], buildDeprecatedRows(reports)),
    "## Suggested `pnpm.overrides`",
    "",
    buildOverridesBlock(reports)
  ];

  await writeFile(filePath, sections.join("\n"), "utf-8");
  return filePath;
}

// ============================================================
// Apply
// ============================================================

async function applyUpgrades(reports: PackageReport[]): Promise<void> {
  const targets = reports.filter(
    r => r.classification === "safe-patch" || r.classification === "safe-minor"
  );

  if (targets.length === 0) {
    consola.info("No safe patch/minor upgrades to apply.");
    return;
  }

  const directDeps = await loadDirectDeps();
  const direct = targets.filter(r => directDeps.has(r.name));
  const transitive = targets.filter(r => !directDeps.has(r.name));

  if (transitive.length > 0) {
    consola.warn(
      `${transitive.length} transitive upgrade(s) cannot be applied via 'pnpm up' — they have no direct declaration.`
    );
    console.log(chalk.dim("  Add to pnpm-workspace.yaml under \"overrides\":"));

    for (const r of transitive) {
      console.log(chalk.dim(`  ${r.name}: "${r.candidate!.version}"`));
    }
  }

  if (direct.length === 0) {
    consola.info("No direct dependency upgrades to apply.");
    return;
  }

  const specs = direct.map(r => `${r.name}@${r.candidate!.version}`);
  consola.start(`Applying ${specs.length} direct upgrade(s)...`);
  await execa("pnpm", ["-r", "up", ...specs], { stdio: "inherit" });
  consola.success("Applied. Run your test suite before committing.");
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const opts = parseCli();

  if (opts.help) {
    printHelp();
    return;
  }

  // Early refusal for --apply on a dirty tree, before any network work.
  if (opts.apply && !opts.allowDirty && !await isGitClean()) {
    consola.error("Working tree is dirty. Commit/stash first, or rerun with --allow-dirty.");
    process.exitCode = 3;
    return;
  }

  consola.start("Running pnpm audit and pnpm outdated...");
  const [auditRaw, outdated] = await Promise.all([runPnpmAudit(), runPnpmOutdated()]);
  const env = ingestPnpmAudit(auditRaw);
  const baseVulnCount = [...env.byPackage.values()].reduce((n, l) => n + l.length, 0);
  consola.info(`pnpm audit: ${baseVulnCount} advisory finding(s). pnpm outdated: ${Object.keys(outdated).length} candidate(s).`);

  consola.start("Cross-checking with OSV.dev...");
  await crossCheckWithOsv(env);

  consola.start("Enriching with GitHub Advisory (CVSS)...");
  await enrichWithGhsa(env);

  consola.start("Fetching npm registry metadata...");
  const reports = await buildReports(env, outdated, opts);
  const stats = countByClassification(reports);

  printTerminal(reports, stats, opts);

  if (opts.writeReport) {
    const path = await writeMarkdownReport(reports, stats, opts);
    consola.success(`Markdown report: ${chalk.cyan(path)}`);
  }

  if (opts.apply) {
    await applyUpgrades(reports);
  }

  if (opts.ci) {
    const hasIssue = stats.vuln > 0 || stats.safePatch + stats.safeMinor > 0;
    // Preserve any earlier non-zero exitCode (e.g. dirty-tree refusal = 3).
    const prev = typeof process.exitCode === "number" ? process.exitCode : 0;
    process.exitCode = Math.max(prev, hasIssue ? 1 : 0);
  }
}

await main();
