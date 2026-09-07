import type { FieldPermission, KeyedFormField } from "../types";
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
  /**
   * The field being written, when the caller knows it. Used only to coerce the
   * value to the shape that field's control and validation expect; omitted for
   * a `set_field` aiming at a key the scope's schema does not declare.
   */
  targetField?: KeyedFormField;
  value: unknown;
}): void {
  if (!isWritableFieldPermission(getFieldPermission(args.fieldPermissions, topLevelKey(args.key)))) {
    return;
  }

  const name = `${args.prefix}${args.key}`;
  const value = coerceToFieldValue(args.targetField, args.value);

  if (isDeepEqual(args.form.getFieldValue(name), value)) {
    return;
  }

  args.form.setFieldValue(name, value, {
    dontRunListeners: true,
    dontUpdateMeta: true
  });
}

/**
 * Bring a written value to the shape its target field actually holds.
 *
 * The designer's literal editor is a plain text input, so every literal
 * `assign` / `set_field` value arrives as a string no matter what it is aimed
 * at. A string in a number field silently disables the numeric constraint
 * checks — they gate on `typeof value === "number"` — and the backend, which
 * does not accept a string there, then rejects the whole submission with no
 * field-level hint. A switch is worse: the string `"false"` is truthy, so the
 * control reads "on".
 *
 * Only the two value shapes a string genuinely breaks are coerced. String-like
 * fields take whatever they are given, exactly as before: an expression that
 * resolves to a number is a legitimate thing to put in a text field, and
 * stringifying it here would be a second, unasked-for behaviour change.
 */
function coerceToFieldValue(field: KeyedFormField | undefined, value: unknown): unknown {
  if (field === undefined || typeof value !== "string") {
    return value;
  }

  if (field.type === "number") {
    const trimmed = value.trim();

    if (trimmed === "") {
      return undefined;
    }

    const parsed = Number(trimmed);

    // A non-numeric literal is a design error. Writing `undefined` leaves the
    // control empty, which the required check reports honestly — better than
    // parking a string the backend will reject at submit time.
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (field.type === "switch") {
    return value === "true" || value === "1";
  }

  return value;
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
