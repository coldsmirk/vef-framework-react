import type { CodeMap, CodeMapEntry, CodeMapParams, CodeValue, UnmappedPolicy } from "../../types";

/**
 * Client mirror of the Go `definition.codeSetPattern`: alphanumeric edges
 * with `_ . -` in between, at most 128 characters.
 */
export const CODE_SET_PATTERN = /^[A-Z0-9](?:[\w.-]*[A-Z0-9])?$/i;

/**
 * Display labels for the unmapped policies, shared by the list column and the
 * form select.
 */
export const UNMAPPED_POLICY_LABELS: Record<UnmappedPolicy, string> = {
  reject: "未收录报错",
  passthrough: "透传原值",
  fallback: "返回兜底值"
};

const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?$/;

/**
 * Parse one editor cell into its stored JSON value: bare numbers and
 * true/false become typed literals, a double-quoted text unwraps to the
 * literal string, everything else stays a string — mirroring the server's
 * type-preserving storage.
 */
export function parseCodeValue(text: string): CodeValue {
  const trimmed = text.trim();

  if (NUMBER_PATTERN.test(trimmed)) {
    return Number(trimmed);
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length >= 2) {
    try {
      const parsed: unknown = JSON.parse(trimmed);

      if (typeof parsed === "string") {
        return parsed;
      }
    } catch {
      // Not a valid JSON string literal; keep the raw text.
    }
  }

  return trimmed;
}

// A string that would parse into another type (or into an unwrapped string)
// must be quoted to survive the round trip.
function needsQuoting(text: string): boolean {
  return NUMBER_PATTERN.test(text) || text === "true" || text === "false" || text.startsWith("\"") || text !== text.trim();
}

/**
 * Format one stored value back into its editor cell form, the inverse of
 * {@link parseCodeValue}.
 */
export function formatCodeValue(value: CodeValue | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return needsQuoting(value) ? JSON.stringify(value) : value;
  }

  return String(value);
}

/**
 * Fold a value into the lookup key form — the client mirror of the Go
 * `definition.NormalizeCodeValue`, used by duplicate detection.
 */
export function normalizeCodeValue(value: CodeValue): string {
  return typeof value === "string" ? value : String(value);
}

function sideValues(primary: CodeValue, aliases: CodeValue[] | undefined): CodeValue[] {
  return [primary, ...aliases ?? []];
}

/**
 * Client mirror of the Go save-time entry validation: no empty values, and
 * per-side uniqueness across primaries and aliases by normalized form (so
 * `1` and `"1"` collide). Returns human-readable issues, empty when valid.
 */
export function validateCodeMapEntries(entries: CodeMapEntry[]): string[] {
  const issues: string[] = [];
  const seen = { canonical: new Map<string, number>(), external: new Map<string, number>() };

  for (const [index, entry] of entries.entries()) {
    collectSideIssues("canonical", entry, index, seen.canonical, issues);
    collectSideIssues("external", entry, index, seen.external, issues);
  }

  return issues;
}

const SIDE_LABELS = { canonical: "标准侧", external: "外部侧" } as const;

// One side's pass of the duplicate scan: primaries and aliases share the
// side's normalized key space.
function collectSideIssues(
  side: "canonical" | "external",
  entry: CodeMapEntry,
  index: number,
  seen: Map<string, number>,
  issues: string[]
): void {
  const values = sideValues(entry[side], entry[`${side}Aliases`]);

  for (const value of values) {
    if (value === "") {
      issues.push(`第 ${index + 1} 行${SIDE_LABELS[side]}存在空值`);
      continue;
    }

    const key = normalizeCodeValue(value);
    const priorRow = seen.get(key);

    if (priorRow === undefined) {
      seen.set(key, index);
    } else if (priorRow === index) {
      issues.push(`第 ${index + 1} 行${SIDE_LABELS[side]}值「${key}」重复`);
    } else {
      issues.push(`第 ${index + 1} 行${SIDE_LABELS[side]}值「${key}」与第 ${priorRow + 1} 行重复`);
    }
  }
}

/**
 * The code map form's values: fallback values are edited in their display
 * form and parsed into typed values on submit.
 */
export interface CodeMapFormValues {
  id?: string;
  systemId: string;
  codeSet: string;
  name: string;
  entries: CodeMapEntry[];
  onUnmapped: UnmappedPolicy;
  fallbackCanonical: string;
  fallbackExternal: string;
  isEnabled: boolean;
}

/**
 * Defaults for a newly created code map: fail-closed policy, enabled.
 */
export const CODE_MAP_FORM_DEFAULTS: Partial<CodeMapFormValues> = {
  codeSet: "",
  name: "",
  entries: [],
  onUnmapped: "reject",
  fallbackCanonical: "",
  fallbackExternal: "",
  isEnabled: true
};

/**
 * Project a saved code map into editable form values.
 */
export function codeMapToFormValues(row: CodeMap): CodeMapFormValues {
  return {
    id: row.id,
    systemId: row.systemId,
    codeSet: row.codeSet,
    name: row.name,
    entries: row.entries ?? [],
    onUnmapped: row.onUnmapped || "reject",
    fallbackCanonical: formatCodeValue(row.fallbackCanonical),
    fallbackExternal: formatCodeValue(row.fallbackExternal),
    isEnabled: row.isEnabled
  };
}

/**
 * Collapse the form values into API params: fallback values are submitted
 * only under the fallback policy (the server rejects them elsewhere as dead
 * configuration).
 */
export function codeMapFormToParams(values: CodeMapFormValues): CodeMapParams {
  const fallback = values.onUnmapped === "fallback";

  return {
    id: values.id,
    systemId: values.systemId,
    codeSet: values.codeSet,
    name: values.name,
    entries: values.entries,
    onUnmapped: values.onUnmapped,
    fallbackCanonical: fallback ? parseCodeValue(values.fallbackCanonical) : undefined,
    fallbackExternal: fallback ? parseCodeValue(values.fallbackExternal) : undefined,
    isEnabled: values.isEnabled
  };
}
