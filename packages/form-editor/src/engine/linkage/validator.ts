import type {
  Block,
  EffectAction,
  FieldLinkage,
  FieldLinkageAction,
  KeyedFormField,
  KeyedNodeUnion,
  LinkageCondition,
  LinkageTrigger,
  LinkageTriggerKind,
  PresentationLayer,
  StateAction,
  StateActionType,
  UploadField
} from "../../types";
import type { ScopePath } from "../schema/walk";
import type { ValidationIssue } from "../validation";

import { assertNever } from "../assert-never";
import { isKeyedNode } from "../keys";
import { isLeafField, walkNodes } from "../schema/walk";
import { createIssue, isRecord, isValidIdentifier, validateRemoteRequest } from "../validation";
import {
  getActionDataSourceId,
  getActionDescriptor,
  getActionDynamicValues,
  getActionOutput,
  getActionRequests,
  getActionTargetKeys,
  getActionVariable
} from "./action-descriptors";
import { findLinkageCycles } from "./cycle";
import { LINKAGE_OPERATORS } from "./operators";
import { parseLeafSource } from "./scope";
import { hasConditionTriggeredShow } from "./shape";
import { collectConditionSourceKeys } from "./source-tracking";
import {
  ALERT_LEVELS,
  FIELD_TRIGGER_KINDS,
  FORM_TRIGGER_KINDS,
  isStateAction,
  KEYED_ONLY_ACTIONS,
  LINKAGE_ACTION_TYPES
} from "./taxonomy";

export interface LinkageValidationResult {
  issues: ValidationIssue[];
}

/**
 * The trigger / action constraints a given linkage scope enforces. Field rules
 * allow field triggers and state actions; form-scope rules (the global "events"
 * panel) allow only lifecycle / condition triggers and effect actions, because
 * the form has no self field whose state could be derived.
 */
interface RuleScopePolicy {
  triggerKinds: readonly LinkageTriggerKind[];
  allowStateActions: boolean;
}

const FIELD_SCOPE_POLICY: RuleScopePolicy = {
  triggerKinds: FIELD_TRIGGER_KINDS,
  allowStateActions: true
};

const FORM_SCOPE_POLICY: RuleScopePolicy = {
  triggerKinds: FORM_TRIGGER_KINDS,
  allowStateActions: false
};

const ACTION_TYPE_SET: ReadonlySet<string> = new Set(LINKAGE_ACTION_TYPES);
const OPERATOR_SET: ReadonlySet<string> = new Set(LINKAGE_OPERATORS);
const ALERT_LEVEL_SET: ReadonlySet<string> = new Set(ALERT_LEVELS);

/**
 * The state actions that WRITE form-data values (`assign` directly, `script`
 * via its returned `value` patch). Only these create real feedback edges for
 * the cycle detector: the level-stable actions (`show` / `hide` / `enable` /
 * `disable` / `require` / `optional`) derive state from values without ever
 * writing one back (hiding does not clear values in this runtime), so a rule
 * carrying only those may freely reference any field — including the block
 * itself ("require self when self is empty").
 *
 * Declared as a compile-checked table (the taxonomy.ts pattern): a future
 * state action type forces an explicit true/false entry here, so the cycle
 * detector can never silently miss a new value-writing action.
 */
const VALUE_WRITING_STATE_ACTION_TABLE: Record<StateActionType, boolean> = {
  show: false,
  hide: false,
  enable: false,
  disable: false,
  require: false,
  optional: false,
  assign: true,
  script: true
};

const VALUE_WRITING_STATE_ACTIONS: ReadonlySet<StateActionType> = new Set(
  (Object.keys(VALUE_WRITING_STATE_ACTION_TABLE) as StateActionType[])
    .filter(type => VALUE_WRITING_STATE_ACTION_TABLE[type])
);

/**
 * Any keyed leaf field that programmatic value writes (`assign` / `set_fields`)
 * may target — every keyed leaf field except `upload`.
 */
export type WritableTargetField = Exclude<KeyedFormField, UploadField>;

/**
 * Single source of truth for whether a node is a legal write target for
 * programmatic field writes — a keyed leaf field other than `upload` (and never
 * a container such as `subform`). Shared by the validator, runtime write gate,
 * executor target index, and designer pickers.
 */
export function isWritableTargetField(node: Block): node is WritableTargetField {
  return isLeafField(node) && isKeyedNode(node) && node.type !== "upload";
}

/**
 * Per-scope view of the keyed nodes available as linkage sources and targets.
 * A subform template opens its own scope, so a rule's `sourceKey` and
 * `set_fields` targets are resolved against the keys in **its own** scope — a
 * row field references its row siblings, not the outer form, matching the
 * runtime's per-row evaluation.
 */
type KeyedNodesByScope = Map<string, Map<string, KeyedNodeUnion>>;

function scopeId(scope: ScopePath): string {
  return scope.join("/");
}

/**
 * Validates linkage data for one device presentation (import dialog / API
 * payload). The editor's own mutators always produce well-formed trees, so this
 * is the boundary guard. The **tree** must already be structurally valid (run
 * `validateSchema` first); the linkage payloads hanging off it are treated as
 * untrusted JSON and plain-object-guarded before any member access.
 * `formLinkage` is the shared form-scope linkage; pass it alongside the tree it
 * should resolve against (the pc presentation).
 *
 * Walks the presentation's node tree — leaf fields AND containers carry
 * linkage — to (a) flag malformed nodes, (b) confirm referenced source / target
 * keys exist within the rule's value scope (dangling references are warnings:
 * the editor legitimately produces them mid-authoring), (c) reject state
 * actions on edge triggers and keyed-only actions on non-keyed blocks, and
 * (d) accumulate scope-namespaced edges (condition → value-writing state action
 * or `retrigger: "always"` `set_fields`) for the cycle detector. All
 * action-slot traversals run through {@link "./action-descriptors"!ACTION_DESCRIPTORS}.
 */
export function validateLinkageSchema(layer: PresentationLayer, formLinkage?: FieldLinkage): LinkageValidationResult {
  const issues: ValidationIssue[] = [];
  const keyedByScope: KeyedNodesByScope = new Map();

  walkNodes(layer, (node, scope) => {
    if (!isKeyedNode(node)) {
      return;
    }

    const key = scopeId(scope);
    const scopeMap = keyedByScope.get(key) ?? new Map<string, KeyedNodeUnion>();
    scopeMap.set(node.key, node);
    keyedByScope.set(key, scopeMap);
  });

  const edges = new Map<string, Set<string>>();

  walkNodes(layer, (node, scope) => {
    const { linkage } = node;

    if (linkage === undefined) {
      return;
    }

    const where = `node[${node.id}].linkage`;

    if (!isRecord(linkage)) {
      issues.push(createIssue(where, "linkage_malformed"));
      return;
    }

    const scopeKey = scopeId(scope);
    const keyedNodes = keyedByScope.get(scopeKey) ?? new Map<string, KeyedNodeUnion>();

    validateDefaults({
      block: node,
      defaults: linkage.defaults,
      issues,
      where
    });
    validateRules({
      block: node,
      edges,
      issues,
      keyedNodes,
      policy: FIELD_SCOPE_POLICY,
      rules: linkage.rules,
      scopeKey,
      where
    });
    flagUnreachableHidden({
      defaults: linkage.defaults,
      issues,
      rules: linkage.rules,
      where
    });
  });

  // Form-scope linkage (the global "events" panel): lifecycle / condition
  // triggers and effect actions only, resolved against the root value scope.
  if (formLinkage !== undefined) {
    if (isRecord(formLinkage)) {
      // The form has no self field, so default-state overrides are meaningless
      // at this scope — reject them rather than carry dead configuration.
      if (formLinkage.defaults !== undefined) {
        issues.push(createIssue("schema.linkage.defaults", "defaults_on_form_scope"));
      }

      validateRules({
        block: null,
        edges,
        issues,
        keyedNodes: keyedByScope.get(scopeId([])) ?? new Map<string, KeyedNodeUnion>(),
        policy: FORM_SCOPE_POLICY,
        rules: formLinkage.rules,
        scopeKey: scopeId([]),
        where: "schema.linkage"
      });
    } else {
      issues.push(createIssue("schema.linkage", "linkage_malformed"));
    }
  }

  for (const cycle of findLinkageCycles(edges)) {
    issues.push(createIssue("linkage", "cycle_detected", { cycle }));
  }

  return { issues };
}

/**
 * The value-bearing actions (`require` / `optional` / `assign`) and
 * `defaults.required` drive a single keyed leaf field's runtime state
 * (required / value). A subform is keyed but a container — the runtime applies
 * none of these to it — so they are rejected on it, the same as on a non-keyed
 * block, rather than passing validation and silently no-op-ing at runtime.
 * (`show` / `hide` / `enable` / `disable` are NOT gated here: they apply to
 * containers too, a container's `disable` propagating to its descendants.)
 */
function isKeyedLeaf(block: Block): boolean {
  return isLeafField(block) && isKeyedNode(block);
}

function validateDefaults(args: {
  block: Block;
  defaults: unknown;
  issues: ValidationIssue[];
  where: string;
}): void {
  const {
    block,
    defaults,
    issues,
    where
  } = args;

  if (defaults === undefined) {
    return;
  }

  if (!isRecord(defaults)) {
    issues.push(createIssue(`${where}.defaults`, "linkage_malformed"));
    return;
  }

  if (defaults.required === true && !isKeyedLeaf(block)) {
    issues.push(createIssue(`${where}.defaults.required`, "defaults_requires_keyed_leaf"));
  }
}

/**
 * A block that starts hidden can only ever become visible through one of its
 * OWN rules carrying a `show` action — state actions are self-targeted, and
 * the form scope cannot show fields. Default-hidden with no such rule means
 * the block is invisible for the form's whole lifetime; warn, because this is
 * almost always the leftover of deleting the field its show rule depended on.
 */
function flagUnreachableHidden(args: {
  defaults: unknown;
  issues: ValidationIssue[];
  rules: unknown;
  where: string;
}): void {
  const {
    defaults,
    issues,
    rules,
    where
  } = args;

  if (!isRecord(defaults) || defaults.hidden !== true) {
    return;
  }

  if (!hasConditionTriggeredShow(rules)) {
    issues.push(createIssue(`${where}.defaults.hidden`, "default_hidden_unreachable"));
  }
}

function validateRules(args: {
  block: Block | null;
  edges: Map<string, Set<string>>;
  issues: ValidationIssue[];
  keyedNodes: Map<string, KeyedNodeUnion>;
  policy: RuleScopePolicy;
  rules: unknown;
  scopeKey: string;
  where: string;
}): void {
  const {
    block,
    edges,
    issues,
    keyedNodes,
    policy,
    rules,
    scopeKey,
    where
  } = args;

  if (rules === undefined) {
    return;
  }

  if (!Array.isArray(rules)) {
    issues.push(createIssue(`${where}.rules`, "rules_not_array"));
    return;
  }

  const entries: unknown[] = rules;

  for (const [ruleIndex, rule] of entries.entries()) {
    validateRule({
      block,
      edges,
      issues,
      keyedNodes,
      policy,
      rule,
      scopeKey,
      where: `${where}.rules[${ruleIndex}]`
    });
  }
}

function validateRule(args: {
  block: Block | null;
  edges: Map<string, Set<string>>;
  issues: ValidationIssue[];
  keyedNodes: Map<string, KeyedNodeUnion>;
  policy: RuleScopePolicy;
  rule: unknown;
  scopeKey: string;
  where: string;
}): void {
  const {
    block,
    edges,
    issues,
    keyedNodes,
    policy,
    rule,
    scopeKey,
    where
  } = args;

  if (!isRecord(rule)) {
    issues.push(createIssue(where, "rule_malformed"));
    return;
  }

  const ruleId = typeof rule.id === "string" && rule.id.length > 0 ? rule.id : undefined;

  if (ruleId === undefined) {
    issues.push(createIssue(`${where}.id`, "id_required"));
  }

  const trigger = validateTrigger({
    block,
    issues,
    keyedNodes,
    policy,
    ruleId,
    trigger: rule.trigger,
    where: `${where}.trigger`
  });

  const isEdge = trigger !== undefined && trigger.kind !== "condition";
  const validActions = validateActions({
    actions: rule.actions,
    block,
    isEdge,
    issues,
    keyedNodes,
    policy,
    ruleId,
    where: `${where}.actions`
  });

  // Only a condition trigger paired with a value-WRITING state action
  // (`assign` / `script`) makes this block's value depend on its source fields
  // — the feedback loop the cycle detector guards. Level-stable state actions
  // and rising-edge effect rules create no write-back, so they are free to
  // reference any field, including the block itself.
  const writesValue = validActions.some(action => isStateAction(action) && VALUE_WRITING_STATE_ACTIONS.has(action.type));

  // Both write-back cases register on the same edge map for the same reason —
  // a condition trigger whose actions write a statically-known key make that
  // key depend on the trigger's source fields, the feedback loop the cycle
  // detector guards. Collect the write targets in registration order, then
  // register each:
  //  - the block's OWN key, when a value-WRITING state action (`assign` /
  //    `script`) pairs with the condition (level-stable state actions and
  //    effect-only rules create no write-back);
  //  - every `set_fields` target when the trigger sets `retrigger: "always"`,
  //    which re-fires whenever a tracked source changes while the condition
  //    holds (rising-edge `set_fields` fires once per false→true transition
  //    and settles, so it stays edge-free).
  // A plain list (not a set) preserves the per-target issue output when a key
  // is targeted twice.
  if (trigger?.kind === "condition") {
    const targetKeys: string[] = [];

    if (policy.allowStateActions && writesValue && block && isKeyedNode(block)) {
      targetKeys.push(block.key);
    }

    if (trigger.retrigger === "always") {
      for (const action of validActions) {
        for (const slot of getActionTargetKeys(action)) {
          if (typeof slot.targetKey === "string" && slot.targetKey.length > 0) {
            targetKeys.push(slot.targetKey);
          }
        }
      }
    }

    for (const targetKey of targetKeys) {
      registerRuleEdges({
        condition: trigger.condition,
        edges,
        issues,
        ruleId,
        scopeKey,
        targetKey,
        where: `${where}.trigger.condition`
      });
    }
  }
}

/**
 * Validate a rule's trigger against the scope policy. Returns the trigger only
 * when it is structurally valid end to end — for a `condition` kind that
 * includes its condition tree, so callers (action / edge rules) can safely walk
 * `trigger.condition`. Returns `undefined` otherwise.
 */
function validateTrigger(args: {
  block: Block | null;
  issues: ValidationIssue[];
  keyedNodes: Map<string, KeyedNodeUnion>;
  policy: RuleScopePolicy;
  ruleId: string | undefined;
  trigger: unknown;
  where: string;
}): LinkageTrigger | undefined {
  const {
    block,
    issues,
    keyedNodes,
    policy,
    ruleId,
    trigger,
    where
  } = args;

  if (!isRecord(trigger) || typeof trigger.kind !== "string") {
    issues.push(createIssue(where, "trigger_malformed", undefined, ruleId));
    return undefined;
  }

  const allowedKinds: readonly string[] = policy.triggerKinds;

  if (!allowedKinds.includes(trigger.kind)) {
    issues.push(createIssue(`${where}.kind`, "trigger_kind_invalid", { kind: trigger.kind }, ruleId));
    return undefined;
  }

  // The `change` and `commit` edges fire off a keyed leaf field's value edits;
  // a container or non-keyed presentation block has no such hook, so the
  // trigger would never run. Reject it rather than pass validation and silently
  // no-op at runtime.
  if ((trigger.kind === "change" || trigger.kind === "commit") && block !== null && !isKeyedLeaf(block)) {
    issues.push(createIssue(`${where}.kind`, "trigger_requires_keyed_leaf", { kind: trigger.kind }, ruleId));
    return undefined;
  }

  if (trigger.kind === "condition") {
    if (trigger.retrigger !== undefined && trigger.retrigger !== "edge" && trigger.retrigger !== "always") {
      issues.push(createIssue(`${where}.retrigger`, "retrigger_invalid", undefined, ruleId));
    }

    if (trigger.when !== undefined) {
      issues.push(createIssue(`${where}.when`, "trigger_malformed", undefined, ruleId));
    }

    const conditionValid = validateCondition({
      condition: trigger.condition,
      issues,
      keyedNodes,
      ruleId,
      where: `${where}.condition`
    });

    if (!conditionValid) {
      return undefined;
    }

    return trigger as unknown as LinkageTrigger;
  }

  // `retrigger` tunes how a condition-triggered rule re-fires; an unknown
  // value is structural breakage, while a value on an edge trigger is dead
  // configuration the runtime ignores.
  if (trigger.retrigger !== undefined) {
    if (trigger.retrigger !== "edge" && trigger.retrigger !== "always") {
      issues.push(createIssue(`${where}.retrigger`, "retrigger_invalid", undefined, ruleId));
    } else {
      issues.push(createIssue(`${where}.retrigger`, "retrigger_ignored", undefined, ruleId));
    }
  }

  if (trigger.when !== undefined) {
    validateCondition({
      condition: trigger.when,
      issues,
      keyedNodes,
      ruleId,
      where: `${where}.when`
    });
  }

  // Runtime-verified: `kind` is one of this scope's trigger kinds.
  return trigger as unknown as LinkageTrigger;
}

/**
 * Validate a rule's action list. Returns the actions that passed the
 * plain-object guard and the known-type check, so the caller's value-writing
 * scan never touches malformed entries.
 */
function validateActions(args: {
  actions: unknown;
  block: Block | null;
  isEdge: boolean;
  issues: ValidationIssue[];
  keyedNodes: Map<string, KeyedNodeUnion>;
  policy: RuleScopePolicy;
  ruleId: string | undefined;
  where: string;
}): FieldLinkageAction[] {
  const {
    actions,
    block,
    isEdge,
    issues,
    keyedNodes,
    policy,
    ruleId,
    where
  } = args;

  if (!Array.isArray(actions)) {
    issues.push(createIssue(where, "actions_not_array", undefined, ruleId));
    return [];
  }

  if (actions.length === 0) {
    issues.push(createIssue(where, "actions_empty", undefined, ruleId));
    return [];
  }

  const entries: unknown[] = actions;
  const valid: FieldLinkageAction[] = [];
  const priorOutputs = new Set<string>();

  for (const [actionIndex, action] of entries.entries()) {
    const validated = validateAction({
      action,
      block,
      isEdge,
      issues,
      keyedNodes,
      policy,
      priorOutputs,
      ruleId,
      where: `${where}[${actionIndex}]`
    });

    if (validated !== undefined) {
      valid.push(validated);
    }
  }

  return valid;
}

function validateAction(args: {
  action: unknown;
  block: Block | null;
  isEdge: boolean;
  issues: ValidationIssue[];
  keyedNodes: Map<string, KeyedNodeUnion>;
  policy: RuleScopePolicy;
  priorOutputs: Set<string>;
  ruleId: string | undefined;
  where: string;
}): FieldLinkageAction | undefined {
  const {
    action,
    block,
    isEdge,
    issues,
    keyedNodes,
    policy,
    priorOutputs,
    ruleId,
    where
  } = args;

  if (!isRecord(action)) {
    issues.push(createIssue(where, "action_malformed", undefined, ruleId));
    return undefined;
  }

  if (typeof action.type !== "string" || !ACTION_TYPE_SET.has(action.type)) {
    issues.push(createIssue(`${where}.type`, "action_unknown_type", { type: String(action.type) }, ruleId));
    return undefined;
  }

  // Runtime-verified discriminant; each member's payload is still
  // runtime-checked field by field below before being trusted.
  const typed = action as FieldLinkageAction;

  if (isStateAction(typed)) {
    if (isEdge) {
      issues.push(createIssue(`${where}.type`, "state_action_on_edge_trigger", { type: typed.type }, ruleId));
      return undefined;
    }

    if (!policy.allowStateActions) {
      issues.push(createIssue(`${where}.type`, "state_action_on_form_scope", { type: typed.type }, ruleId));
      return undefined;
    }

    validateStateActionExtras({
      action: typed,
      block,
      issues,
      ruleId,
      where
    });
    validateActionDescriptorSlots({
      action: typed,
      issues,
      keyedNodes,
      priorOutputs,
      ruleId,
      where
    });
    return typed;
  }

  validateEffectActionExtras({
    action: typed,
    issues,
    ruleId,
    where
  });
  validateActionDescriptorSlots({
    action: typed,
    issues,
    keyedNodes,
    priorOutputs,
    ruleId,
    where
  });
  return typed;
}

function validateStateActionExtras(args: {
  action: StateAction;
  block: Block | null;
  issues: ValidationIssue[];
  ruleId: string | undefined;
  where: string;
}): void {
  const {
    action,
    block,
    issues,
    ruleId,
    where
  } = args;

  if (KEYED_ONLY_ACTIONS.has(action.type) && (!block || !isKeyedLeaf(block))) {
    issues.push(createIssue(`${where}.type`, "action_requires_keyed_leaf", { type: action.type }, ruleId));
  }

  if (action.type === "script") {
    if (typeof action.source !== "string") {
      issues.push(createIssue(`${where}.source`, "action_malformed", undefined, ruleId));
    } else if (action.source.length === 0) {
      issues.push(createIssue(`${where}.source`, "source_empty", undefined, ruleId));
    }
  }
}

function validateEffectActionExtras(args: {
  action: EffectAction;
  issues: ValidationIssue[];
  ruleId: string | undefined;
  where: string;
}): void {
  const {
    action,
    issues,
    ruleId,
    where
  } = args;

  if (action.onError !== undefined && action.onError !== "stop" && action.onError !== "continue") {
    issues.push(createIssue(`${where}.onError`, "on_error_invalid", undefined, ruleId));
  }

  switch (action.type) {
    case "set_fields": {
      if (!Array.isArray(action.assignments)) {
        issues.push(createIssue(`${where}.assignments`, "action_malformed", undefined, ruleId));
        return;
      }

      if (action.assignments.length === 0) {
        issues.push(createIssue(`${where}.assignments`, "assignments_empty", undefined, ruleId));
        return;
      }

      for (const [index, entry] of action.assignments.entries()) {
        if (!isRecord(entry)) {
          issues.push(createIssue(`${where}.assignments[${index}]`, "action_malformed", undefined, ruleId));
        }
      }

      return;
    }

    case "select_record": {
      if (action.title !== undefined && typeof action.title !== "string") {
        issues.push(createIssue(`${where}.title`, "action_malformed", undefined, ruleId));
      }

      if (action.emptyMessage !== undefined && typeof action.emptyMessage !== "string") {
        issues.push(createIssue(`${where}.emptyMessage`, "action_malformed", undefined, ruleId));
      }

      if (action.whenNone !== undefined && action.whenNone !== "continue" && action.whenNone !== "stop") {
        issues.push(createIssue(`${where}.whenNone`, "when_none_invalid", undefined, ruleId));
      }

      if (action.columns !== undefined) {
        if (Array.isArray(action.columns)) {
          for (const [index, column] of action.columns.entries()) {
            if (!isRecord(column) || typeof column.path !== "string" || typeof column.label !== "string") {
              issues.push(createIssue(`${where}.columns[${index}]`, "action_malformed", undefined, ruleId));
            }
          }
        } else {
          issues.push(createIssue(`${where}.columns`, "action_malformed", undefined, ruleId));
        }
      }

      return;
    }

    case "alert": {
      if (action.level !== undefined && !ALERT_LEVEL_SET.has(action.level)) {
        issues.push(createIssue(`${where}.level`, "alert_level_invalid", undefined, ruleId));
      }

      break;
    }

    default: {
      break;
    }
  }
}

/**
 * Validate every structural slot declared on `action`'s descriptor: requests,
 * target keys, dynamic values (checking `$steps` against `priorOutputs`),
 * conditions, variable, dataSourceId, and finally the step's own `output`
 * (registered into `priorOutputs` AFTER checking its inputs so a step can
 * never reference itself).
 */
function validateActionDescriptorSlots(args: {
  action: FieldLinkageAction;
  issues: ValidationIssue[];
  keyedNodes: Map<string, KeyedNodeUnion>;
  priorOutputs: Set<string>;
  ruleId: string | undefined;
  where: string;
}): void {
  const {
    action,
    issues,
    keyedNodes,
    priorOutputs,
    ruleId,
    where
  } = args;

  if (!getActionDescriptor(action)) {
    return;
  }

  for (const slot of getActionRequests(action)) {
    issues.push(...validateRemoteRequest(slot.request, `${where}.${slot.path}`, ruleId));
  }

  const seenTargets = new Set<string>();

  for (const slot of getActionTargetKeys(action)) {
    const slotPath = `${where}.${slot.path}`;

    if (typeof slot.targetKey !== "string") {
      issues.push(createIssue(slotPath, "action_malformed", undefined, ruleId));
      continue;
    }

    if (slot.targetKey.length === 0) {
      issues.push(createIssue(slotPath, "target_key_empty", undefined, ruleId));
      continue;
    }

    if (seenTargets.has(slot.targetKey)) {
      issues.push(createIssue(slotPath, "target_key_duplicate", { key: slot.targetKey }, ruleId));
      continue;
    }

    seenTargets.add(slot.targetKey);

    const targetNode = keyedNodes.get(slot.targetKey);

    if (targetNode === undefined) {
      // Dangling targets are warnings: deleting a field after a rule
      // referenced it is a legitimate mid-authoring state.
      issues.push(createIssue(slotPath, "target_key_unresolved", { key: slot.targetKey }, ruleId));
      continue;
    }

    if (!isWritableTargetField(targetNode)) {
      issues.push(createIssue(slotPath, "target_not_writable", { key: slot.targetKey, type: targetNode.type }, ruleId));
    }
  }

  for (const slot of getActionDynamicValues(action)) {
    validateDynamicValue({
      allowSteps: slot.allowSteps,
      issues,
      keyedNodes,
      priorOutputs,
      ruleId,
      value: slot.value,
      where: `${where}.${slot.path}`
    });
  }

  const variableSlot = getActionVariable(action);

  if (variableSlot !== undefined) {
    const slotPath = `${where}.${variableSlot.path}`;

    if (typeof variableSlot.value !== "string") {
      issues.push(createIssue(slotPath, "action_malformed", undefined, ruleId));
    } else if (variableSlot.value.length === 0) {
      issues.push(createIssue(slotPath, "variable_empty", undefined, ruleId));
    }
  }

  // Like `set_variable`, the target is a form-global name, not a same-scope
  // keyed node, so only non-emptiness is checked here; the editor's picker
  // constrains it to an existing data source.
  const dataSourceSlot = getActionDataSourceId(action);

  if (dataSourceSlot !== undefined) {
    const slotPath = `${where}.${dataSourceSlot.path}`;

    if (typeof dataSourceSlot.value !== "string") {
      issues.push(createIssue(slotPath, "action_malformed", undefined, ruleId));
    } else if (dataSourceSlot.value.length === 0) {
      issues.push(createIssue(slotPath, "data_source_id_empty", undefined, ruleId));
    }
  }

  const outputSlot = getActionOutput(action);

  if (outputSlot !== undefined) {
    const slotPath = `${where}.${outputSlot.path}`;

    if (outputSlot.value === undefined) {
      if (outputSlot.required) {
        issues.push(createIssue(slotPath, "action_malformed", undefined, ruleId));
      }
    } else if (typeof outputSlot.value !== "string" || !isValidIdentifier(outputSlot.value)) {
      issues.push(createIssue(slotPath, "output_invalid", undefined, ruleId));
    } else if (priorOutputs.has(outputSlot.value)) {
      issues.push(createIssue(slotPath, "output_duplicate", { output: outputSlot.value }, ruleId));
    } else {
      priorOutputs.add(outputSlot.value);
    }
  }
}

/**
 * Validate a condition tree. Returns `true` only when the tree is structurally
 * sound — every node a plain object of a known kind, group children arrays,
 * `sourceKey` / `source` strings — i.e. safe for `collectConditionSourceKeys`
 * and the runtime matcher to walk. Empty groups and empty / dangling source
 * keys are warnings and do NOT invalidate the tree.
 */
function validateCondition(args: {
  condition: unknown;
  issues: ValidationIssue[];
  keyedNodes: Map<string, KeyedNodeUnion>;
  ruleId: string | undefined;
  where: string;
}): boolean {
  const {
    condition,
    issues,
    keyedNodes,
    ruleId,
    where
  } = args;

  if (!isRecord(condition)) {
    issues.push(createIssue(where, "condition_malformed", undefined, ruleId));
    return false;
  }

  switch (condition.kind) {
    case "leaf": {
      return validateLeafCondition({
        condition,
        issues,
        keyedNodes,
        ruleId,
        where
      });
    }

    case "group": {
      return validateGroupCondition({
        condition,
        issues,
        keyedNodes,
        ruleId,
        where
      });
    }

    case "expression": {
      if (typeof condition.source !== "string") {
        issues.push(createIssue(`${where}.source`, "condition_malformed", undefined, ruleId));
        return false;
      }

      if (condition.source.length === 0) {
        issues.push(createIssue(`${where}.source`, "source_empty", undefined, ruleId));
      }

      return true;
    }

    default: {
      issues.push(createIssue(`${where}.kind`, "condition_kind_invalid", undefined, ruleId));
      return false;
    }
  }
}

/**
 * Check that a scope path (`sourceKey` in a leaf condition or `path` in a
 * `reference` dynamic value) names something that can hold a value: a form key
 * present in the rule's value scope (spelled plain or `$form.key`), a path
 * under a context root, or (when `allowSteps` is set) a prior step's output
 * under `$steps`. A context path's members are host data this static pass
 * cannot see into, so any member is accepted; a `$` root no scope slot answers
 * to is not — it could never resolve, and silently never matching is exactly
 * what a typo like `$applcant` would otherwise do.
 *
 * When `keyedNodes` is omitted (form-global remote data sources whose scope
 * depends on where they are referenced), form-key existence is skipped while
 * scope-root validity and `$steps` prohibition still hold.
 */
export function validateScopePath(args: {
  allowSteps: boolean;
  issues: ValidationIssue[];
  keyedNodes: ReadonlyMap<string, unknown> | ReadonlySet<string> | undefined;
  priorOutputs?: ReadonlySet<string>;
  ruleId?: string;
  sourceKey: string;
  where: string;
}): void {
  const {
    allowSteps,
    issues,
    keyedNodes,
    priorOutputs,
    ruleId,
    sourceKey,
    where
  } = args;
  const source = parseLeafSource(sourceKey);

  switch (source.kind) {
    case "form": {
      if (keyedNodes !== undefined && !keyedNodes.has(source.key)) {
        issues.push(createIssue(where, "source_key_unresolved", { key: sourceKey }, ruleId));
      }

      return;
    }

    case "context": {
      return;
    }

    case "step": {
      if (!allowSteps) {
        issues.push(createIssue(where, "source_scope_unknown", { key: sourceKey }, ruleId));
        return;
      }

      if (!priorOutputs?.has(source.step)) {
        issues.push(createIssue(where, "step_output_unresolved", { step: source.step }, ruleId));
      }

      return;
    }

    case "unknown": {
      issues.push(createIssue(where, "source_scope_unknown", { key: sourceKey }, ruleId));
      return;
    }

    default: {
      assertNever(source);
    }
  }
}

function validateLeafCondition(args: {
  condition: Record<string, unknown>;
  issues: ValidationIssue[];
  keyedNodes: Map<string, KeyedNodeUnion>;
  ruleId: string | undefined;
  where: string;
}): boolean {
  const {
    condition,
    issues,
    keyedNodes,
    ruleId,
    where
  } = args;

  let valid = true;
  const { operator, sourceKey } = condition;

  if (typeof sourceKey !== "string") {
    issues.push(createIssue(`${where}.sourceKey`, "condition_malformed", undefined, ruleId));
    valid = false;
  } else if (sourceKey.length === 0) {
    issues.push(createIssue(`${where}.sourceKey`, "source_key_empty", undefined, ruleId));
  } else {
    validateScopePath({
      allowSteps: false,
      issues,
      keyedNodes,
      ruleId,
      sourceKey,
      where: `${where}.sourceKey`
    });
  }

  if (typeof operator !== "string" || !OPERATOR_SET.has(operator)) {
    issues.push(createIssue(`${where}.operator`, "operator_invalid", undefined, ruleId));
    valid = false;
  }

  return valid;
}

function validateGroupCondition(args: {
  condition: Record<string, unknown>;
  issues: ValidationIssue[];
  keyedNodes: Map<string, KeyedNodeUnion>;
  ruleId: string | undefined;
  where: string;
}): boolean {
  const {
    condition,
    issues,
    keyedNodes,
    ruleId,
    where
  } = args;

  let valid = true;

  if (condition.logic !== "all" && condition.logic !== "any") {
    issues.push(createIssue(`${where}.logic`, "logic_invalid", undefined, ruleId));
    valid = false;
  }

  if (!Array.isArray(condition.children)) {
    issues.push(createIssue(`${where}.children`, "children_not_array", undefined, ruleId));
    return false;
  }

  const { children } = condition;

  if (children.length === 0) {
    // Legal, but almost always a mistake: `all` over no children holds, so
    // the rule always applies, while `any` never does. The editor never
    // authors one, so it arrives only from imported or hand-written JSON.
    issues.push(createIssue(`${where}.children`, "condition_group_empty", undefined, ruleId));
  }

  for (const [childIndex, child] of children.entries()) {
    const childValid = validateCondition({
      condition: child,
      issues,
      keyedNodes,
      ruleId,
      where: `${where}.children[${childIndex}]`
    });

    valid &&= childValid;
  }

  return valid;
}

/**
 * Validate one {@link "../../types"!DynamicValue} slot (`literal` / `reference` /
 * `expression`). Shared by linkage actions and remote option-source params.
 */
export function validateDynamicValue(args: {
  allowSteps: boolean;
  issues: ValidationIssue[];
  keyedNodes: ReadonlyMap<string, unknown> | ReadonlySet<string> | undefined;
  priorOutputs?: ReadonlySet<string>;
  ruleId?: string;
  value: unknown;
  where: string;
}): void {
  const {
    allowSteps,
    issues,
    keyedNodes,
    priorOutputs,
    ruleId,
    value,
    where
  } = args;

  if (!isRecord(value)) {
    issues.push(createIssue(where, "value_malformed", undefined, ruleId));
    return;
  }

  if (value.kind === "literal") {
    return;
  }

  if (value.kind === "reference") {
    if (typeof value.path !== "string") {
      issues.push(createIssue(`${where}.path`, "value_malformed", undefined, ruleId));
    } else if (value.path.length === 0) {
      issues.push(createIssue(`${where}.path`, "source_key_empty", undefined, ruleId));
    } else {
      validateScopePath({
        allowSteps,
        issues,
        keyedNodes,
        priorOutputs,
        ruleId,
        sourceKey: value.path,
        where: `${where}.path`
      });
    }

    return;
  }

  if (value.kind === "expression") {
    if (typeof value.source !== "string") {
      issues.push(createIssue(`${where}.source`, "value_malformed", undefined, ruleId));
    } else if (value.source.length === 0) {
      issues.push(createIssue(`${where}.source`, "source_empty", undefined, ruleId));
    }

    return;
  }

  issues.push(createIssue(`${where}.kind`, "value_malformed", undefined, ruleId));
}

/**
 * Register the dependency edges of one value-writing condition rule onto
 * `targetKey` — the block's own key for `assign` / `script`, the written
 * field's key for a `retrigger: "always"` `set_fields` target. Reached only
 * with a structurally validated condition (see `validateTrigger`), so the
 * source-key walk cannot crash. A self-reference here is an error: the rule
 * writes the very value it reads, the textbook feedback loop.
 */
function registerRuleEdges(args: {
  condition: LinkageCondition;
  edges: Map<string, Set<string>>;
  issues: ValidationIssue[];
  ruleId: string | undefined;
  scopeKey: string;
  targetKey: string;
  where: string;
}): void {
  const {
    condition,
    edges,
    issues,
    ruleId,
    scopeKey,
    targetKey,
    where
  } = args;

  const sources = new Set<string>();
  collectConditionSourceKeys(condition, sources);

  for (const sourceKey of sources) {
    if (sourceKey === targetKey) {
      issues.push(createIssue(where, "self_reference", undefined, ruleId));
      continue;
    }

    // Namespace edges by scope so identical keys reused across scopes never
    // form a false cross-scope cycle.
    const from = `${scopeKey}::${sourceKey}`;
    const to = `${scopeKey}::${targetKey}`;
    const targets = edges.get(from) ?? new Set<string>();
    targets.add(to);
    edges.set(from, targets);
  }
}
