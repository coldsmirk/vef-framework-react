import type { FieldPermission } from "../types";
import type { RuntimeForm } from "./types";

import { isDeepEqual } from "@vef-framework-react/shared";

import { getFieldPermission, isWritableFieldPermission } from "../engine/linkage";

/**
 * The single gate for every programmatic form-value write: the state lane's
 * `assign` applications (`applyScopedAssignments`) and the effect lane's
 * `set_field` both land here, so the server permission clamp holds on every
 * write path — not just user edits.
 *
 * - **Permission guard**: `fieldPermissions` is the firing scope's clamp map.
 * The root scope carries the host map; subform-row scopes pass `undefined` —
 * the same threading rule as the clamp in `evaluateRuntimeStates` (top-level
 * permissions never address a template field). A write whose target's
 * top-level key is clamped non-writable (`"visible"` / `"hidden"`) is dropped
 * silently, mirroring the render path's "never crash the renderer" posture.
 * - **No-op bail**: a write of the value the target already holds is dropped.
 * TanStack's `setBy` mints a new values object even for an identical leaf,
 * which would read as a value change and re-fire an opaque-condition `always`
 * rule forever. Deep-equal because an expression-resolved value may be a
 * fresh but content-equal object.
 * - **Meta-free**: the write never runs the target's onChange listeners or
 * marks it touched, so a programmatic write (e.g. a `load` effect) never
 * surfaces a premature validation error. Validation itself still runs
 * (`dontValidate` stays default) so a written value is checked like an edit.
 */
export function writeFieldValue(args: {
  fieldPermissions: Record<string, FieldPermission> | undefined;
  form: RuntimeForm;
  /**
   * The target's key within the firing value scope (`set_field`'s `targetKey`).
   */
  key: string;
  /**
   * The scope's field-name prefix: `""` at the root, `"lines[0]."` in a row.
   */
  prefix: string;
  value: unknown;
}): void {
  if (!isWritableFieldPermission(getFieldPermission(args.fieldPermissions, topLevelKey(args.key)))) {
    return;
  }

  const name = `${args.prefix}${args.key}`;

  if (isDeepEqual(args.form.getFieldValue(name), args.value)) {
    return;
  }

  args.form.setFieldValue(name, args.value, {
    dontRunListeners: true,
    dontUpdateMeta: true
  });
}

/**
 * The first path segment of a target key. A schema-authored target is a plain
 * scope-level key, but an untrusted schema may aim a path
 * (`"lines[0].amount"`) — the clamp addresses the top-level binding, so the
 * guard resolves it the way `resolveScopeValues` tokenizes names.
 */
function topLevelKey(key: string): string {
  return key.match(/[^.[\]]+/)?.[0] ?? key;
}
