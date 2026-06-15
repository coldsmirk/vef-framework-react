import type {
  Block,
  ExpressionContext,
  KeyedFormField,
  LinkageActionValue,
  LinkageCondition,
  LinkageEvaluators,
  RuntimeSchema,
  StateAction,
  SubformNode
} from "../../types";

import { exhaustive } from "../assert-never";
import { isKeyedField } from "../keys";
import { isLeafField, isRootScope, walkNodes } from "../schema/walk";
import { resolveLinkageEvaluators } from "./default-evaluator";
import { matchLeaf } from "./operators";
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

export interface EvaluateLinkageOptions {
  evaluators?: LinkageEvaluators;
  /**
   * Extra scope (`$vars` / `$user` / `$node`) surfaced to expressions and
   * scripts. Omitted at design time; the runtime composes it from the form's
   * variables and the host context.
   */
  expressionContext?: ExpressionContext;
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
 */
export function evaluateLinkage(
  node: Block,
  values: Record<string, unknown>,
  options: EvaluateLinkageOptions = {}
): RuntimeFieldState {
  const { linkage } = node;

  if (!linkage) {
    return emptyRuntimeState;
  }

  const evaluators = resolveLinkageEvaluators(options.evaluators);
  const { expressionContext } = options;
  const state: RuntimeFieldState = {
    ...emptyRuntimeState,
    hidden: linkage.defaults?.hidden === true,
    disabled: linkage.defaults?.disabled === true,
    required: linkage.defaults?.required === true
  };

  for (const rule of linkage.rules ?? []) {
    // Edge triggers (field events, form lifecycle) drive the effect lane and
    // never derive state, so only condition triggers are folded here.
    if (rule.trigger.kind !== "condition") {
      continue;
    }

    if (!matchCondition(rule.trigger.condition, values, evaluators, expressionContext)) {
      continue;
    }

    // Apply this rule's state actions in order; effect actions are skipped so
    // the fold stays pure and idempotent (it re-runs on every value change).
    for (const action of rule.actions) {
      if (isStateAction(action)) {
        applyAction(state, action, values, evaluators, expressionContext);
      }
    }
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

    states[node.id] = evaluateLinkage(node, values, { evaluators, expressionContext: options.expressionContext });
  });

  return states;
}

/**
 * Recursive condition matcher. The three condition kinds short-circuit
 * appropriately so a large tree never evaluates more leaves than needed.
 * Exported so the effect lane can re-evaluate a rule's trigger condition for
 * rising-edge detection without duplicating the recursion.
 */
export function matchCondition(
  condition: LinkageCondition,
  values: Record<string, unknown>,
  evaluators: Required<LinkageEvaluators>,
  context?: ExpressionContext
): boolean {
  switch (condition.kind) {
    case "leaf": {
      return matchLeaf(condition, values);
    }

    case "group": {
      return condition.logic === "all"
        ? condition.children.every(child => matchCondition(child, values, evaluators, context))
        : condition.children.some(child => matchCondition(child, values, evaluators, context));
    }

    case "expression": {
      return evaluators.evaluateExpression(condition.source, values, context);
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
  context: ExpressionContext | undefined
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

      if (!patch) {
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
 * or an expression run through the injected evaluator. Shared by the state
 * lane's `assign` and the effect lane's value-bearing actions (`set_field` /
 * `alert` / `navigate`).
 */
export function resolveActionValue(
  actionValue: LinkageActionValue,
  values: Record<string, unknown>,
  evaluators: Required<LinkageEvaluators>,
  context?: ExpressionContext
): unknown {
  return actionValue.kind === "literal"
    ? actionValue.value
    : evaluators.evaluateAssignExpression(actionValue.source, values, context);
}

/**
 * Build the `$vars` map from a schema's form-global variable declarations,
 * keyed by variable name with each `defaultValue`. The runtime merges this with
 * any host-supplied overrides to form the expression context's `variables`.
 */
export function deriveExpressionVariables(schema: RuntimeSchema): Record<string, unknown> {
  const variables: Record<string, unknown> = {};

  for (const variable of schema.variables ?? []) {
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
 * slot rather than an uncontrolled `undefined` — or to `minRows` blank rows
 * (each built from its template) so a required-minimum group renders its rows
 * on load.
 */
export function deriveDefaultValues(
  schema: RuntimeSchema,
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
      const seeded = initialValues[node.key];
      values[node.key] = Array.isArray(seeded)
        ? seeded.map(row => {
            // Fresh seed per row: nested subform arrays must not share refs.
            return {
              ...deriveDefaultValues({ id: node.id, children: node.template }),
              ...row !== null && typeof row === "object" ? row as Record<string, unknown> : {}
            };
          })
        : seedSubformRows(node);
      return;
    }

    if (isLeafField(node) && isKeyedField(node)) {
      values[node.key] = initialValues[node.key] ?? getFieldDefaultValue(node);
    }
  });

  return values;
}

/**
 * Build `minRows` blank rows for a subform, each a fresh record seeded from the
 * template (nested subforms recurse to their own `minRows`).
 */
function seedSubformRows(subform: SubformNode): Array<Record<string, unknown>> {
  const count = subform.minRows ?? 0;

  return Array.from({ length: count }, () => deriveDefaultValues({
    id: subform.id,
    children: subform.template
  }));
}

/**
 * Type-appropriate empty value for a keyed leaf field. TanStack Form treats
 * `undefined` as uncontrolled, so string-like fields seed `""`; a number seeds
 * `undefined` (an empty numeric input) and a switch seeds `false`.
 */
function getFieldDefaultValue(field: KeyedFormField): unknown {
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

    case "daterange": {
      return [];
    }

    default: {
      return "";
    }
  }
}
