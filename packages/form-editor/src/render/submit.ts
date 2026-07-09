import type { EvaluateLinkageOptions, RuntimeFieldState } from "../engine/linkage";
import type { RuntimeFormValues } from "../runtime/types";
import type {
  Block,
  EvaluationContext,
  FieldPermission,
  KeyedFormField,
  KeyedNodeUnion,
  LinkageEvaluators,
  RuntimeSchema,
  SubformNode
} from "../types";

import { isKeyedNode, isValidatableField } from "../engine/keys";
import {
  deriveDefaultValues,
  evaluateLinkage,
  getFieldPermission,
  isEmptyRuntimeValue,
  isWritableFieldPermission
} from "../engine/linkage";
import { containerBodies } from "../engine/schema/nodes";
import { isContainerNode, walkNodes } from "../engine/schema/walk";
import { resolveScopeValues } from "../runtime/resolve-scope-values";

/**
 * The pure submit / derivation half of the runtime renderer: payload filtering,
 * the schema-driven submit validation pass, the per-field live validators, and
 * the form-identity / row-seed derivations. Everything here is side-effect-free
 * so `form-renderer.tsx` stays a composition layer.
 */

/**
 * A keyed node's effective state within one value scope: its own evaluated
 * linkage outcome OR'd with every ancestor container's `hidden` / `disabled`.
 * `own` carries the node's un-folded state for the outcomes that do not inherit
 * from containers (`required`, `assigned`).
 */
interface EffectiveKeyedState {
  hidden: boolean;
  disabled: boolean;
  own: RuntimeFieldState;
}

/**
 * Visit every keyed node (leaf field or subform) of one value scope with its
 * {@link EffectiveKeyedState}, evaluating each linkage-bearing node exactly once
 * in a single tree walk. Sections / tabs / flex / grid keep the enclosing value
 * scope, so their evaluated `hidden` / `disabled` folds onto descendants; a
 * subform's template is a separate per-row value scope, so the walk stops at the
 * subform node itself — callers recurse per row with that row's record.
 */
function visitEffectiveKeyedNodes(
  blocks: Block[],
  values: RuntimeFormValues,
  options: EvaluateLinkageOptions,
  visit: (node: KeyedNodeUnion, state: EffectiveKeyedState) => void
): void {
  function walk(siblings: Block[], ancestorHidden: boolean, ancestorDisabled: boolean): void {
    for (const block of siblings) {
      const own = evaluateLinkage(block, values, options);
      const hidden = ancestorHidden || own.hidden;
      const disabled = ancestorDisabled || own.disabled;

      if (isKeyedNode(block)) {
        visit(block, {
          hidden,
          disabled,
          own
        });
      }

      if (isContainerNode(block) && block.type !== "subform") {
        for (const body of containerBodies(block)) {
          walk(body, hidden, disabled);
        }
      }
    }
  }

  walk(blocks, false, false);
}

/**
 * Build the submit payload for one value scope: each keyed field / subform that
 * is not **effectively** hidden — by its own linkage or any ancestor container's
 * (a field inside a linkage-hidden section is just as invisible as a field
 * hidden directly) — contributes its value; a hidden one is dropped whole.
 * A key the server clamped non-writable (`"visible"` / `"hidden"`) is dropped
 * too: the payload carries only writable keys (plus unclamped ones). Subforms
 * recurse per row against that row's own record, so "hidden ⇒ not submitted"
 * holds at every scope. Runs only on submit (a cold path), so the per-call tree
 * walk is fine.
 */
export function filterSubmitValues(args: {
  blocks: Block[];
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  /**
   * Server-resolved clamp for THIS scope's keys. Only the root call passes it;
   * the per-row recursion drops it — a template field is never clamped
   * individually (the subform node itself carries the clamp).
   */
  fieldPermissions?: Record<string, FieldPermission>;
  values: RuntimeFormValues;
}): RuntimeFormValues {
  const options: EvaluateLinkageOptions = {
    evaluators: args.evaluators,
    evaluationContext: args.evaluationContext,
    fieldPermissions: args.fieldPermissions
  };
  const submitValues: RuntimeFormValues = {};

  visitEffectiveKeyedNodes(args.blocks, args.values, options, (node, state) => {
    if (state.hidden) {
      return;
    }

    // Server clamp: only writable keys submit. A `"visible"` (read-only)
    // field's value is display-only; `"hidden"` is already folded into
    // `state.hidden` above, so this check exists for the visible case.
    if (!isWritableFieldPermission(getFieldPermission(args.fieldPermissions, node.key))) {
      return;
    }

    if (node.type === "subform") {
      const raw = args.values[node.key];
      const rows: unknown[] = Array.isArray(raw) ? raw : [];

      // No `fieldPermissions` for the row scope: the clamp stops at the
      // subform node — top-level permissions never address template fields.
      submitValues[node.key] = rows.map(rowValue => filterSubmitValues({
        blocks: node.template,
        evaluators: args.evaluators,
        evaluationContext: args.evaluationContext,
        values: asRecord(rowValue)
      }));
    } else {
      submitValues[node.key] = args.values[node.key];
    }
  });

  return submitValues;
}

/**
 * Schema-driven submit validation: run the same required / constraint checks as
 * the live per-field validators over EVERY keyed field of the schema — root
 * scope and each subform row — independent of what is currently mounted.
 *
 * This is the second layer of a two-layer design:
 *
 * 1. **Live layer** — each mounted `AppField` registers
 * {@link validateRuntimeField} for immediate change-time feedback.
 * 2. **Submit gate (this pass)** — antd Tabs / Collapse (and their antd-mobile
 * counterparts) mount pane content lazily, so a required field in a
 * never-activated tab or a collapsed-by-default section has no mounted
 * validator at all. This pass closes that hole at the form level without
 * forcing panes to mount (which would defeat the lazy mount at 100s of
 * fields). Failures are returned as a per-field-name error map; the runtime
 * form feeds it to TanStack's `fields` error channel so each error blocks
 * submission now and surfaces on the field when its pane is visited.
 *
 * Effectively-hidden fields (own linkage or any ancestor container's — the same
 * fold as {@link filterSubmitValues}) and effectively-disabled fields are
 * exempt: a value that is not submitted, or not editable, must not hold the
 * form hostage. Runs only on submit, so the full walk (rows included) is off
 * the per-keystroke path.
 */
export function collectSubmitErrors(args: {
  blocks: Block[];
  disabled: boolean;
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  /**
   * Server-resolved clamp for the root scope's keys. Folded into the linkage
   * evaluation, so a non-writable field is exempt through the existing
   * hidden / disabled exemption and a `"required"` clamp fails an empty value
   * even without a static `validate.required`.
   */
  fieldPermissions?: Record<string, FieldPermission>;
  namePrefix: string;
  values: RuntimeFormValues;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  // A disabled form is wholly non-editable, mirroring the live lane's bail.
  if (args.disabled) {
    return errors;
  }

  const options: EvaluateLinkageOptions = {
    evaluators: args.evaluators,
    evaluationContext: args.evaluationContext,
    fieldPermissions: args.fieldPermissions
  };

  collectScopeSubmitErrors(args.blocks, args.values, args.namePrefix, options, errors);

  return errors;
}

function collectScopeSubmitErrors(
  blocks: Block[],
  values: RuntimeFormValues,
  namePrefix: string,
  options: EvaluateLinkageOptions,
  errors: Record<string, string>
): void {
  visitEffectiveKeyedNodes(blocks, values, options, (node, state) => {
    if (state.hidden || state.disabled) {
      return;
    }

    if (node.type === "subform") {
      const raw = values[node.key];
      const rows: unknown[] = Array.isArray(raw) ? raw : [];
      // Row scopes evaluate unclamped — top-level permissions stop at the
      // subform node itself (whose clamped hidden / disabled above already
      // exempts the whole subtree).
      const rowOptions: EvaluateLinkageOptions = { ...options, fieldPermissions: undefined };

      for (const [index, rowValue] of rows.entries()) {
        collectScopeSubmitErrors(
          node.template,
          asRecord(rowValue),
          `${namePrefix}${node.key}[${index}].`,
          rowOptions,
          errors
        );
      }

      return;
    }

    const error = validateKeyedFieldValue(node, isRuntimeRequired(node, state.own), values[node.key]);

    if (error !== undefined) {
      errors[`${namePrefix}${node.key}`] = error;
    }
  });
}

/**
 * Live per-field validator, registered by each mounted `AppField` for both the
 * change and submit causes (one callback keeps the two lanes from drifting).
 * The schema-driven submit gate ({@link collectSubmitErrors}) applies the same
 * required / constraint logic to fields that never mounted.
 */
export function validateRuntimeField(args: {
  disabled: boolean;
  evaluators: LinkageEvaluators | undefined;
  evaluationContext: EvaluationContext | undefined;
  field: KeyedFormField;
  /**
   * Server-resolved clamp for the field's own value scope. The renderer passes
   * the map for root-scope fields and `undefined` inside subform rows (a
   * template field is never clamped individually), keeping "rendered
   * read-only" and "skips validation" in agreement for clamped fields.
   */
  fieldPermissions?: Record<string, FieldPermission>;
  namePrefix: string;
  value: unknown;
  values: RuntimeFormValues;
}): string | undefined {
  // A non-editable field must not block submission with any error. `args.disabled`
  // is the inherited disabled state — the form-level prop plus any ancestor
  // container's `disable` rule, threaded in through `ctx.disabled`; the field's
  // own `disable`/`hide` linkage is recomputed below. Mirrors the UI's
  // `disabled={ctx.disabled || runtimeState.disabled}`, so "rendered disabled"
  // and "skips validation" always agree.
  if (args.disabled) {
    return;
  }

  // Evaluate against the field's own value scope: a subform field's condition
  // references its row siblings, not the root form.
  const scopeValues = resolveScopeValues(args.values, args.namePrefix);
  const runtimeState = evaluateLinkage(args.field, scopeValues, {
    evaluators: args.evaluators,
    evaluationContext: args.evaluationContext,
    fieldPermissions: args.fieldPermissions
  });

  if (runtimeState.hidden || runtimeState.disabled) {
    return;
  }

  return validateKeyedFieldValue(args.field, isRuntimeRequired(args.field, runtimeState), args.value);
}

/**
 * The value-level check shared by the live validators and the submit gate.
 * Required catches an absent value; the constraint rules then apply only to a
 * value that is actually present (an empty optional field is not "too short").
 */
export function validateKeyedFieldValue(field: KeyedFormField, required: boolean, value: unknown): string | undefined {
  if (required && isEmptyRuntimeValue(value)) {
    return "此项为必填";
  }

  return isEmptyRuntimeValue(value) ? undefined : validateFieldConstraints(field, value);
}

/**
 * Whether a keyed field is currently required — its static `validate.required`
 * (read through the `Validatable` shape, no cast) or a runtime `require`
 * linkage outcome.
 */
export function isRuntimeRequired(field: KeyedFormField, runtimeState: RuntimeFieldState): boolean {
  const staticRequired = isValidatableField(field) && field.validate?.required === true;

  return staticRequired || runtimeState.required;
}

/**
 * Static constraint rules (`minLength` / `maxLength` / `min` / `max` / `pattern`)
 * checked against a present value. `validate.message`, when set, overrides the
 * default per-rule text. String rules apply to string values, numeric rules to
 * number values, so one `validate` shape serves text and number fields without
 * misfiring across types.
 */
export function validateFieldConstraints(field: KeyedFormField, value: unknown): string | undefined {
  if (!isValidatableField(field) || !field.validate) {
    return;
  }

  const {
    max,
    maxLength,
    message,
    min,
    minLength,
    pattern
  } = field.validate;

  if (typeof value === "string") {
    if (minLength !== undefined && value.length < minLength) {
      return message ?? `最少 ${minLength} 个字符`;
    }

    if (maxLength !== undefined && value.length > maxLength) {
      return message ?? `最多 ${maxLength} 个字符`;
    }

    if (pattern !== undefined && pattern.length > 0 && !matchesPattern(pattern, value)) {
      return message ?? "格式不正确";
    }
  }

  if (typeof value === "number") {
    if (min !== undefined && value < min) {
      return message ?? `不能小于 ${min}`;
    }

    if (max !== undefined && value > max) {
      return message ?? `不能大于 ${max}`;
    }
  }

  return undefined;
}

function matchesPattern(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    // An invalid pattern cannot reject input; `validateSchema` flags it instead.
    return true;
  }
}

/**
 * Seed a fresh subform row: type-appropriate empty values for keyed leaf
 * fields, nested subforms seeded to their own `minRows`.
 */
export function blankSubformRow(subform: SubformNode): Record<string, unknown> {
  return deriveDefaultValues({
    id: subform.id,
    children: subform.template
  });
}

export function buildRuntimeFormId(schema: RuntimeSchema): string {
  const signature: string[] = [];

  walkNodes(schema, (node, scope) => {
    // Non-keyed containers (section / tabs / flex / grid) are pure layout —
    // they neither bind a value nor open a value scope, so wrapping fields in
    // one must NOT force a rebuild. Keyed-ness is the discriminator, not a
    // type list: a future keyed container signs in automatically.
    if (isContainerNode(node) && !isKeyedNode(node)) {
      return;
    }

    // Tag every binding-bearing node by its value scope, so a subform key or a
    // template field (scope > 0) is signed in. TanStack Form only re-seeds
    // values on a formId change, so when any binding changes the id must change
    // too — otherwise an edited (touched) preview keeps stale values / misses
    // new defaults.
    const tag = scope.length > 0 ? `${scope.join("/")}/${node.id}` : node.id;

    signature.push(isKeyedNode(node) ? `${tag}:${node.key}` : tag);
  });

  return `${schema.id}:${signature.join("|")}`;
}

/**
 * A subform row record from untrusted form values: an array entry that is not a
 * plain record evaluates as an empty row rather than crashing the walk.
 */
function asRecord(value: unknown): RuntimeFormValues {
  return value !== null && typeof value === "object" ? value as RuntimeFormValues : {};
}
