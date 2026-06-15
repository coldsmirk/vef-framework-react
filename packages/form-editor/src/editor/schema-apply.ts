import type { DeviceRegistries } from "../engine/registry/form-field-registry";
import type { ValidationIssue } from "../engine/validation";
import type { FormEditorStoreApi } from "../store/form-store";

import { validateSchema } from "../engine/schema/validate";
import { notify } from "./toolbar/notify";

/**
 * Cap on the per-issue lines included in the warning toast — enough to point
 * at the first offenders without turning the toast into a scrollable report.
 */
const WARNING_PREVIEW_LIMIT = 3;

/**
 * One issue rendered as `path：message` (or the bare message when it has no
 * path). Shared by the warning toast and the error block, which differ only in
 * the separator they join the lines with.
 */
function formatIssueLine(issue: ValidationIssue): string {
  return issue.path.length > 0 ? `${issue.path}：${issue.message}` : issue.message;
}

/**
 * One-toast summary for a warning-only apply: total count plus the first few
 * `path：message` lines, with an ellipsis marker when more were truncated.
 */
function formatWarningSummary(warnings: ValidationIssue[]): string {
  const preview = warnings
    .slice(0, WARNING_PREVIEW_LIMIT)
    .map(issue => formatIssueLine(issue))
    .join("；");
  const suffix = warnings.length > WARNING_PREVIEW_LIMIT ? " 等" : "";

  return `导入成功，存在 ${warnings.length} 条警告：${preview}${suffix}`;
}

export interface ApplySchemaJsonResult {
  ok: boolean;
  /**
   * Newline-joined `path：message` lines for error-severity issues.
   */
  errorText?: string;
}

/**
 * Parse + validate raw schema JSON and commit it to the store — the single
 * apply pipeline behind both the import dialog and the editable JSON view, so
 * the two surfaces accept exactly the same inputs with exactly the same
 * feedback. Errors block (returned for inline display); warnings round-trip
 * with one summarizing toast.
 */
export function applySchemaJson(args: { raw: string; registries: DeviceRegistries; storeApi: FormEditorStoreApi }): ApplySchemaJsonResult {
  const {
    raw,
    registries,
    storeApi
  } = args;
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errorText: error instanceof Error ? error.message : "JSON 格式无效" };
  }

  const result = validateSchema(parsed, registries);
  const { schema } = result;

  if (!result.valid || schema === undefined) {
    // Surface every error-severity issue at once so the user can fix them in
    // a single pass rather than play whack-a-mole.
    const errors = result.issues.filter(issue => issue.severity === "error");

    return {
      ok: false,
      errorText: errors
        .map(issue => formatIssueLine(issue))
        .join("\n")
    };
  }

  const warnings = result.issues.filter(issue => issue.severity === "warning");

  if (warnings.length > 0) {
    notify("warning", formatWarningSummary(warnings));
  }

  storeApi.getState().setSchema(schema);

  return { ok: true };
}

/**
 * Trigger a browser download of pretty-printed schema JSON.
 */
export function downloadSchemaJson(json: string, schemaId: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.download = `${schemaId || "form"}.json`;
  anchor.href = url;
  anchor.click();
  // Defer the revoke past this task: several browsers process the programmatic
  // download asynchronously after the click handler returns, and revoking the
  // URL synchronously can abort the download for larger blobs.
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}
