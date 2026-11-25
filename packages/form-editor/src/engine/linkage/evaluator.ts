import type {
  Block,
  EvaluationContext,
  FieldPermission,
  FormDataSource,
  KeyedFormField,
  LinkageActionValue,
  LinkageCondition,
  LinkageEvaluators,
  RuntimeSchema,
  StateAction,
  SubformNode
} from "../../types";

import { exhaustive } from "../assert-never";
import { isKeyedField, isKeyedNode, isValidatableField } from "../keys";
import { getDynamicSubformRows, isFixedSubform, resolveStaticFixedRowItems } from "../schema/subform";
import { isLeafField, isRootScope, walkNodes } from "../schema/walk";
import { isRecord } from "../validation";
import { resolveLinkageEvaluators } from "./default-evaluator";
import { matchLeaf } from "./operators";
import { resolveLeafSourceValue } from "./scope";
import { linkageRules } from "./shape";
import { isStateAction } from "./taxonomy";

/**
 * Runtime state derived for a single field from its linkage rules. Mirrors
 * the shape consumed by `FormRenderer` / `RuntimeStateController` — kept as a
 * plain record so React equality comparisons stay cheap.
 */
export interface RuntimeFieldState {
  hidden: boolean;
  disabled: boolean;
  required: boolean;
  assigned: boolean;
  assignedValue?: unknown;
}

// Frozen: this is the shared default handed out for every rule-less field —
// one stray in-place mutation would poison the default for the whole form.
export const emptyRuntimeState: RuntimeFieldState = Object.freeze({
  hidden: false,
  disabled: false,
  required: false,
  assigned: false
});

// The rule-less counterpart for a statically-required field. A second frozen
// singleton rather than a fresh object per call: the rule-less path is the
// common one, and `stabilizeStateMap` compares by reference first.
const staticRequiredRuntimeState: RuntimeFieldState = Object.freeze({
  hidden: false,
  disabled: false,
  required: true,
  assigned: false
});

export interface EvaluateLinkageOptions {
  evaluators?: LinkageEvaluators;
  /**
   * Extra scope (`$vars` / `$user` / `$node`) surfaced to expressions and
   * scripts. Omitted at design time; the runtime composes it from the form's
   * variables and the host context.
   */
  evaluationContext?: EvaluationContext;
  /**
   * Server-resolved {@link FieldPermission} clamp, keyed by the field's
   * data-binding `key`. Applied to keyed nodes after the linkage fold as the
   * OUTER bound — linkage may narrow (hide / disable) but never widen past the
   * permission. An absent map or absent key means no clamp. Callers evaluating
   * a subform-template scope must NOT pass it: top-level permissions address
   * root-scope keys only, never a template field.
   */
  fieldPermissions?: Record<string, FieldPermission>;
}

/**
 * Resolve one key's clamp from a permission map. Own-property guarded so a
 * field keyed like an Object prototype member (e.g. `"constructor"`) never
 * reads a prototype slot off a JSON-parsed map.
 */
export function getFieldPermission(
  permissions: Record<string, FieldPermission> | undefined,
  key: string
): FieldPermission | undefined {
  return permissions !== undefined && Object.hasOwn(permissions, key) ? permissions[key] : undefined;
}

/**
 * Whether a permission grants write access. `undefined` (no clamp entry) is
 * writable — the renderer stays fully permissive unless the server says
 * otherwise; hosts wanting default-deny materialize the full map server-side.
 */
export function isWritableFieldPermission(permission: FieldPermission | undefined): boolean {
  return permission === undefined || permission === "editable" || permission === "required";
}

/**
 * Fold a keyed node's server permission onto its linkage-derived state. The
 * permission is the OUTER bound — linkage may only narrow, never widen:
 *
 * - `hidden` = permission `"hidden"` OR the linkage outcome.
 * - `disabled` = non-writable OR the linkage outcome (a `"visible"` field
 * renders read-only through the existing disabled channel).
 * - `required` = permission `"required"` (winning over a linkage `optional`),
 * else the linkage outcome — but never on a non-writable field.
 * - a non-writable field's pending `assign` is suppressed so no phantom edit
 * reaches a field the server would reject.
 *
 * `"editable"` (and an absent entry) changes nothing and preserves the
 * un-clamped state reference, so unclamped fields keep their identity for the
 * downstream reference stabilization.
 */
function clampToFieldPermission(
  node: Block,
  state: RuntimeFieldState,
  permissions: Record<string, FieldPermission> | undefined
): RuntimeFieldState {
  if (permissions === undefined || !isKeyedNode(node)) {
    return state;
  }

  const permission = getFieldPermission(permissions, node.key);

  if (permission === undefined || permission === "editable") {
    return state;
  }

  const writable = isWritableFieldPermission(permission);
  const clamped: RuntimeFieldState = {
    ...state,
    hidden: permission === "hidden" || state.hidden,
    disabled: !writable || state.disabled,
    required: permission === "required" || (state.required && writable)
  };

  if (!writable && clamped.assigned) {
    clamped.assigned = false;
    clamped.assignedValue = undefined;
  }

  return clamped;
}

/**
 * Evaluates one field's linkage in two phases:
 *
 * 1. Seed the state from `linkage.defaults` (visibility / disabled /
 * required overrides applied before any rule fires).
 * 2. Walk `linkage.rules` in declaration order. Only `condition`-triggered
 * rules feed this lane; for each whose condition matches, its **state**
 * actions are applied (effect actions belong to the side-effect lane and are
 * skipped). Later rules overwrite earlier ones — order is the user's
 * tie-breaker.
 *
 * When `options.fieldPermissions` is supplied, the server clamp is composed
 * onto the fold's outcome last (see {@link EvaluateLinkageOptions.fieldPermissions}).
 */
export function evaluateLinkage(
  node: Block,
  values: Record<string, unknown>,
  options: EvaluateLinkageOptions = {}
): RuntimeFieldState {
  return clampToFieldPermission(
    node,
    evaluateLinkageResolved(node, values, resolveLinkageEvaluators(options.evaluators), options.evaluationContext),
    options.fieldPermissions
  );
}

/**
 * The body of {@link evaluateLinkage}, taking an already-resolved evaluator
 * set. `evaluateRuntimeStates` calls this directly so the per-keystroke pass
 * resolves the evaluators ONCE, not once per linkage-bearing field.
 */
function evaluateLinkageResolved(
  node: Block,
  values: Record<string, unknown>,
  evaluators: Required<LinkageEvaluators>,
  evaluationContext: EvaluationContext | undefined
): RuntimeFieldState {
  const { linkage } = node;
  // The static `validate.required` SEEDS the fold rather than being OR-ed onto
  // its result, so a fired `optional` / a `script` returning `{ required: false }`
  // can relax it. Or-ing afterwards made both a no-op on any field the designer
  // had marked required — with no way for the user to tell, since the action is
  // labelled 取消必填 in the designer.
  const staticRequired = (isLeafField(node) && isValidatableField(node) && node.validate?.required === true)
    || (node.type === "subform" && (
      isFixedSubform(node)
        ? node.rows.required === true
        : (getDynamicSubformRows(node).min ?? 0) >= 1
    ));

  if (!linkage) {
    return staticRequired ? staticRequiredRuntimeState : emptyRuntimeState;
  }

  const state: RuntimeFieldState = {
    ...emptyRuntimeState,
    hidden: linkage.defaults?.hidden === true,
    disabled: linkage.defaults?.disabled === true,
    required: staticRequired || linkage.defaults?.required === true
  };

  for (const rule of linkageRules(linkage)) {
    // Shape guard first: the render path evaluates host-supplied schemas that
    // may never have passed validateLinkageSchema, and a malformed rule must
    // degrade to "skipped", never crash. Then: edge triggers (field events,
    // form lifecycle) drive the effect lane and never derive state, so only
    // condition triggers are folded here.
    if (!isRecord(rule) || !isRecord(rule.trigger) || rule.trigger.kind !== "condition") {
      continue;
    }

    if (!matchCondition(rule.trigger.condition, values, evaluators, evaluationContext)) {
      continue;
    }

    if (!Array.isArray(rule.actions)) {
      continue;
    }

    // Apply this rule's state actions in order; effect actions are skipped so
    // the fold stays pure and idempotent (it re-runs on every value change).
    for (const action of rule.actions) {
      if (isRecord(action) && isStateAction(action)) {
        applyAction(state, action, values, evaluators, evaluationContext);
      }
    }
  }

  // Only a keyed leaf can receive an assignment: `applyScopedAssignments`
  // walks leaf fields only, so an `assigned` computed for a container —
  // reachable via a script's `value` patch, which no static validator can see
  // into — would be silently dropped downstream. Enforce the invariant here
  // so "assigned ⇒ keyed leaf" holds at the evaluator level.
  if (state.assigned && !(isLeafField(node) && isKeyedField(node))) {
    state.assigned = false;
    state.assignedValue = undefined;
  }

  return state;
}

/**
 * Evaluates linkage for every field in a schema. Used by the renderer to
 * derive the full runtime-state map in one pass per value change.
 */
export function evaluateRuntimeStates(
  schema: RuntimeSchema,
  values: Record<string, unknown>,
  options: EvaluateLinkageOptions = {}
): Record<string, RuntimeFieldState> {
  const evaluators = resolveLinkageEvaluators(options.evaluators);
  const states: Record<string, RuntimeFieldState> = {};

  walkNodes(schema, (node, scope) => {
    // Subform-template nodes (non-root scope) are evaluated separately, per
    // row, by each `SubformRowController` — it calls this same function over the
    // template against that row's scoped value slice and publishes a nested
    // runtime-state scope. Including them here would key every row's state under
    // the one shared template id, so they are skipped.
    if (!isRootScope(scope)) {
      return;
    }

    // The server permission clamp composes onto the fold's outcome here —
    // after linkage evaluation, before the caller's reference stabilization —
    // so field components consume it through the ordinary state channels.
    states[node.id] = clampToFieldPermission(
      node,
      evaluateLinkageResolved(node, values, evaluators, options.evaluationContext),
      options.fieldPermissions
    );
  });

  return states;
}

/**
 * Recursive condition matcher. The three condition kinds short-circuit
 * appropriately so a large tree never evaluates more leaves than needed.
 * Exported so the effect lane can re-evaluate a rule's trigger condition for
 * rising-edge detection without duplicating the recursion.
 *
 * Structurally defensive: a missing / non-object condition, a group without a
 * `children` array, or an out-of-contract `kind` degrades to "no match" — the
 * render path may evaluate a host-supplied schema that never passed
 * `validateLinkageSchema`, and `matchLeaf`'s "never crash the renderer"
 * contract must hold for shape, not just for values.
 */
export function matchCondition(
  condition: LinkageCondition,
  values: Record<string, unknown>,
  evaluators: Required<LinkageEvaluators>,
  context?: EvaluationContext
): boolean {
  if (!isRecord(condition)) {
    return false;
  }

  switch (condition.kind) {
    case "leaf": {
      return matchLeaf(condition, values, context);
    }

    case "group": {
      if (!Array.isArray(condition.children)) {
        return false;
      }

      return condition.logic === "all"
        ? condition.children.every(child => matchCondition(child, values, evaluators, context))
        : condition.children.some(child => matchCondition(child, values, evaluators, context));
    }

    case "expression": {
      return evaluators.evaluateExpression(condition.source, values, context);
    }

    default: {
      exhaustive(condition);
      return false;
    }
  }
}

/**
 * Fold a single **state** action into the accumulating runtime state. Effect
 * actions never reach here — `evaluateLinkage` filters them out with
 * `isStateAction` so this switch stays exhaustive over the `StateAction` union.
 */
function applyAction(
  state: RuntimeFieldState,
  action: StateAction,
  values: Record<string, unknown>,
  evaluators: Required<LinkageEvaluators>,
  context: EvaluationContext | undefined
): void {
  switch (action.type) {
    case "show": {
      state.hidden = false;
      return;
    }

    case "hide": {
      state.hidden = true;
      return;
    }

    case "enable": {
      state.disabled = false;
      return;
    }

    case "disable": {
      state.disabled = true;
      return;
    }

    case "require": {
      state.required = true;
      return;
    }

    case "optional": {
      state.required = false;
      return;
    }

    case "assign": {
      state.assigned = true;
      state.assignedValue = resolveActionValue(action.value, values, evaluators, context);
      return;
    }

    case "script": {
      const patch = evaluators.evaluateScriptAction(action.source, values, context);

      // Scripts are arbitrary JS: a truthy non-object return (`return true;`,
      // a plausible slip for `return { hidden: true }`) must degrade to "no
      // patch" like any other malformed result — the `in` operator below
      // throws on primitives, and a broken script must not crash the form.
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return;
      }

      if (patch.hidden !== undefined) {
        state.hidden = patch.hidden;
      }

      if (patch.disabled !== undefined) {
        state.disabled = patch.disabled;
      }

      if (patch.required !== undefined) {
        state.required = patch.required;
      }

      if ("value" in patch) {
        state.assigned = true;
        state.assignedValue = patch.value;
      }

      return;
    }

    default: {
      // Unknown action types are ignored on the public render path (the schema
      // may be untrusted); the never-check keeps the switch exhaustive.
      exhaustive(action);
    }
  }
}

/**
 * Resolve a {@link LinkageActionValue} to a concrete value: a literal verbatim,
 * a scope-path reference via {@link resolveLeafSourceValue}, or an expression
 * run through the injected evaluator. Shared by the state lane's `assign`,
 * remote option-source params, and the effect lane's value-bearing actions.
 *
 * `options.allowSteps` gates `$steps.<output>` references — `false` by default
 * (conditions, state actions, option-source params) and `true` inside effect
 * action sequences.
 */
export function resolveActionValue(
  actionValue: LinkageActionValue,
  values: Record<string, unknown>,
  evaluators: Required<LinkageEvaluators>,
  context?: EvaluationContext,
  options?: { allowSteps?: boolean }
): unknown {
  if (!isRecord(actionValue)) {
    return undefined;
  }

  switch (actionValue.kind) {
    case "literal": {
      return actionValue.value;
    }

    case "reference": {
      if (typeof actionValue.path !== "string" || actionValue.path.length === 0) {
        return undefined;
      }

      return resolveLeafSourceValue(actionValue.path, values, context, options);
    }

    case "expression": {
      if (typeof actionValue.source !== "string") {
        return undefined;
      }

      return evaluators.evaluateAssignExpression(actionValue.source, values, context);
    }

    default: {
      return undefined;
    }
  }
}

/**
 * Build the `$vars` map from a schema's form-global variable declarations,
 * keyed by variable name with each `defaultValue`. The runtime merges this with
 * any host-supplied overrides to form the evaluation context's `variables`.
 */
export function deriveEvaluationVariables(schema: RuntimeSchema): Record<string, unknown> {
  const variables: Record<string, unknown> = {};
  const schemaVariables = schema.variables ?? [];

  for (const variable of schemaVariables) {
    if (variable.name.length > 0) {
      variables[variable.name] = variable.defaultValue;
    }
  }

  return variables;
}

/**
 * Builds the initial value map for a form from its schema. Each root-scope
 * keyed field is seeded with a type-appropriate empty value (see
 * {@link getFieldDefaultValue}) so the runtime form always has a defined slot —
 * TanStack Form treats `undefined` as "uncontrolled". A subform is seeded from
 * the supplied initial array — each supplied row merged over a fresh blank-row
 * seed, so a row record missing a template key still gets that field's default
 * slot rather than an uncontrolled `undefined` — or per its `rows` config
 * (`rows.min` blank rows for dynamic, static items for fixed).
 */
export function deriveDefaultValues(
  schema: Omit<RuntimeSchema, "dataSources"> & { dataSources?: readonly FormDataSource[] },
  initialValues: Record<string, unknown> = {}
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  walkNodes(schema, (node, scope) => {
    // Only seed the root value scope; a subform's template fields live under
    // the subform's array value and are seeded per-row when a row is added.
    if (!isRootScope(scope)) {
      return;
    }

    if (node.type === "subform") {
      const seeded = seedFor(initialValues, node.key);

      if (Array.isArray(seeded) && seeded.length > 0) {
        values[node.key] = seeded.map(row => {
          // Fresh seed per row: nested subform arrays must not share refs.
          return {
            ...deriveDefaultValues({
              id: node.id,
              children: node.template,
              dataSources: schema.dataSources
            }),
            // isRecord (not a bare typeof check): an array row must fall
            // back to the blank seed, not spread its indices into the record.
            ...isRecord(row) && row
          };
        });
      } else if (Array.isArray(seeded)) {
        // Explicit empty array on a dynamic subform stays empty; on a fixed-row
        // subform an empty initial value means "new fill", so static items seed
        // immediately while async sources stay `[]` until resolved.
        values[node.key] = isFixedSubform(node)
          ? seedSubformRows(node, schema.dataSources)
          : [];
      } else {
        values[node.key] = seedSubformRows(node, schema.dataSources);
      }

      return;
    }

    if (isLeafField(node) && isKeyedField(node)) {
      values[node.key] = seedFor(initialValues, node.key) ?? getFieldDefaultValue(node);
    }
  });

  return values;
}

/**
 * One key's seed from the host's initial values. Own-property guarded for the
 * same reason {@link getFieldPermission} is: a field keyed like an Object
 * prototype member ("constructor", "toString") is legal grammar, and reading
 * the prototype slot would seed the field with a function that renders as
 * source text and vanishes at JSON.stringify.
 */
function seedFor(initialValues: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(initialValues, key) ? initialValues[key] : undefined;
}

/**
 * Build initial rows for a subform on a new fill: `rows.min` blank rows for a
 * dynamic subform, or one seeded row per static item (with its `{ value, label }`
 * snapshot under `itemKey`) for a fixed-row subform whose source resolves
 * synchronously; async fixed sources (`codeSet` / `remote`) start as `[]` and
 * are seeded by the runtime once resolved.
 */
function seedSubformRows(
  subform: SubformNode,
  dataSources: readonly FormDataSource[] | undefined
): Array<Record<string, unknown>> {
  if (isFixedSubform(subform)) {
    const items = resolveStaticFixedRowItems(subform.rows, dataSources);

    if (!items || items.length === 0) {
      return [];
    }

    return items.map(option => {
      return {
        ...deriveDefaultValues({
          id: subform.id,
          children: subform.template,
          dataSources
        }),
        [subform.rows.itemKey]: {
          value: option.value,
          label: option.label
        }
      };
    });
  }

  const count = getDynamicSubformRows(subform).min ?? 0;

  return Array.from({ length: count }, () => deriveDefaultValues({
    id: subform.id,
    children: subform.template,
    dataSources
  }));
}

/**
 * Type-appropriate empty value for a keyed leaf field. TanStack Form treats
 * `undefined` as uncontrolled, so string-like fields seed `""`; a number seeds
 * `undefined` (an empty numeric input) and a switch seeds `false`.
 */
export function getFieldDefaultValue(field: KeyedFormField): unknown {
  switch (field.type) {
    case "number": {
      return undefined;
    }

    case "switch": {
      return false;
    }

    case "checkbox-group": {
      return [];
    }

    case "multi-select": {
      return [];
    }

    case "daterange": {
      return [];
    }

    case "upload": {
      // Matches what the widget itself emits when the user clears it, so
      // "never touched" and "emptied" are one shape: a list for a multi-file
      // field (a `json` column under table storage), `null` for a single one.
      return (field.maxCount ?? 1) > 1 ? [] : null;
    }

    default: {
      return "";
    }
  }
}
