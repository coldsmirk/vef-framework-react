import type { FieldLinkageAction, FieldLinkageRule } from "../../../../types";

import { getStepOutputName, renameStepOutputInRule } from "../../../../engine/linkage";
import { isValidIdentifier } from "../../../../engine/validation";

export type StepOutputAction = Extract<FieldLinkageAction, { type: "api_call" | "select_record" }>;

/**
 * A step's identity among its rule's. Actions authored here carry an id; one
 * from a hand-written schema may not, and goes by its position.
 */
export function actionKey(action: FieldLinkageAction, index: number): string {
  return action.id ?? `action-${index}`;
}

/**
 * Whether `action` carries a step `output` name (`api_call` / `select_record`).
 */
export function hasStepOutput(action: FieldLinkageAction): action is StepOutputAction {
  return action.type === "api_call" || action.type === "select_record";
}

/**
 * Why a step's result cannot be stored under `name`, or `null` when it can. An
 * optional result (`api_call`) may be left unnamed, and is then not stored.
 */
export function stepOutputError(name: string, required: boolean, usedNames: ReadonlySet<string>): string | null {
  if (name.length === 0) {
    return required ? "请填写结果名，供后续步骤引用" : null;
  }

  if (!isValidIdentifier(name)) {
    return "结果名须以字母或下划线开头，仅含字母、数字和下划线";
  }

  return usedNames.has(name) ? `结果名「${name}」与本规则其它步骤重复` : null;
}

function effectiveOutputText(
  action: FieldLinkageAction,
  index: number,
  outputDrafts: Readonly<Record<string, string>>
): string {
  const key = actionKey(action, index);

  return Object.hasOwn(outputDrafts, key)
    ? outputDrafts[key] ?? ""
    : getStepOutputName(action) ?? "";
}

/**
 * Every non-empty step output name currently held by steps other than
 * `excludeIndex`, reflecting uncommitted `outputDrafts` over committed names.
 */
export function collectEffectiveOutputNames(
  actions: readonly FieldLinkageAction[],
  outputDrafts: Readonly<Record<string, string>>,
  excludeIndex: number
): Set<string> {
  const used = new Set<string>();

  for (const [index, action] of actions.entries()) {
    if (index === excludeIndex || !hasStepOutput(action)) {
      continue;
    }

    const name = effectiveOutputText(action, index, outputDrafts);

    if (name.length > 0) {
      used.add(name);
    }
  }

  return used;
}

/**
 * Validate every step output name across `actions` (incorporating uncommitted
 * `outputDrafts`) and return per-key error messages plus the first invalid step
 * index. Committed (non-drafted) names are claimed first in step order so
 * typing a duplicate into another step blames the step being edited (or, for
 * two pre-existing duplicates, the later duplicate) rather than an untouched
 * earlier producer.
 */
export function computeOutputErrors(
  actions: readonly FieldLinkageAction[],
  outputDrafts: Readonly<Record<string, string>>
): { byKey: Map<string, string>; firstInvalidIndex: number | null } {
  const byKey = new Map<string, string>();
  let firstInvalidIndex: number | null = null;

  const committedNames = new Set<string>();

  for (const [index, action] of actions.entries()) {
    if (!hasStepOutput(action)) {
      continue;
    }

    const key = actionKey(action, index);

    if (Object.hasOwn(outputDrafts, key)) {
      continue;
    }

    const value = getStepOutputName(action) ?? "";
    const error = stepOutputError(value, action.type === "select_record", committedNames);

    if (error !== null) {
      byKey.set(key, error);

      if (firstInvalidIndex === null) {
        firstInvalidIndex = index;
      }
    } else if (value.length > 0) {
      committedNames.add(value);
    }
  }

  for (const [index, action] of actions.entries()) {
    if (!hasStepOutput(action)) {
      continue;
    }

    const key = actionKey(action, index);

    if (!Object.hasOwn(outputDrafts, key)) {
      continue;
    }

    const value = outputDrafts[key] ?? "";
    const error = stepOutputError(value, action.type === "select_record", collectEffectiveOutputNames(actions, outputDrafts, index));

    if (error !== null) {
      byKey.set(key, error);

      if (firstInvalidIndex === null || index < firstInvalidIndex) {
        firstInvalidIndex = index;
      }
    }
  }

  return { byKey, firstInvalidIndex };
}

/**
 * Drop draft entries whose step was removed or switched to an action type that
 * has no output. Returns the original object when nothing was pruned.
 */
export function pruneOutputDrafts(
  actions: readonly FieldLinkageAction[],
  outputDrafts: Record<string, string>
): Record<string, string> {
  const activeKeys = new Set<string>();

  for (const [index, action] of actions.entries()) {
    if (hasStepOutput(action)) {
      activeKeys.add(actionKey(action, index));
    }
  }

  let changed = false;
  const next: Record<string, string> = {};

  for (const [key, value] of Object.entries(outputDrafts)) {
    if (activeKeys.has(key)) {
      next[key] = value;
    } else {
      changed = true;
    }
  }

  return changed ? next : outputDrafts;
}

/**
 * Whether any step has an uncommitted output-name draft that differs from its
 * currently stored output name.
 */
export function hasPendingOutputEdits(
  actions: readonly FieldLinkageAction[],
  outputDrafts: Readonly<Record<string, string>>
): boolean {
  for (const [index, action] of actions.entries()) {
    if (!hasStepOutput(action)) {
      continue;
    }

    const key = actionKey(action, index);

    if (Object.hasOwn(outputDrafts, key) && outputDrafts[key] !== (getStepOutputName(action) ?? "")) {
      return true;
    }
  }

  return false;
}

/**
 * Flush every valid uncommitted output-name draft onto `rule`, propagating each
 * rename through downstream `$steps.<name>` references.
 */
export function applyOutputDrafts(
  rule: FieldLinkageRule,
  outputDrafts: Readonly<Record<string, string>>
): FieldLinkageRule {
  let nextActions = rule.actions;

  for (const [index, action] of nextActions.entries()) {
    if (!hasStepOutput(action)) {
      continue;
    }

    const key = actionKey(action, index);

    if (!Object.hasOwn(outputDrafts, key)) {
      continue;
    }

    const nextText = outputDrafts[key] ?? "";
    const committed = getStepOutputName(action) ?? "";

    if (nextText !== committed) {
      nextActions = renameStepOutputInRule(nextActions, index, nextText.length > 0 ? nextText : undefined);
    }
  }

  return nextActions === rule.actions ? rule : { ...rule, actions: nextActions };
}
