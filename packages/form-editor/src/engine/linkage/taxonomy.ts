import type {
  EffectAction,
  EffectActionType,
  FieldLinkageAction,
  LinkageActionType,
  LinkageAlertLevel,
  LinkageTriggerKind,
  StateAction,
  StateActionType
} from "../../types";

/**
 * The action / trigger vocabulary, in one place so the engine, validator, and
 * editor never drift. Every list is derived from a `Record<Union, …>` table
 * (the `CONTAINER_TYPE_TABLE` pattern in `types/schema.ts`), so BOTH drift
 * directions fail to compile: an unknown entry breaks the table's key type, and
 * an omitted union member leaves the record incomplete. `Object.keys` preserves
 * string-key insertion order, so the table order doubles as the editor display
 * order.
 */

/**
 * State action discriminators, in editor display order. State actions derive a
 * field's runtime state and run only on the pure (condition) state lane.
 */
const STATE_ACTION_TYPE_TABLE: Record<StateActionType, true> = {
  show: true,
  hide: true,
  enable: true,
  disable: true,
  require: true,
  optional: true,
  assign: true,
  script: true
};

export const STATE_ACTION_TYPES: readonly StateActionType[]
  = Object.keys(STATE_ACTION_TYPE_TABLE) as StateActionType[];

/**
 * Effect action discriminators, in editor display order. Effect actions fire
 * side effects on a trigger edge and run only on the side-effect lane.
 */
const EFFECT_ACTION_TYPE_TABLE: Record<EffectActionType, true> = {
  set_field: true,
  set_variable: true,
  refresh_data_source: true,
  alert: true,
  api_call: true,
  navigate: true,
  submit: true,
  reset: true
};

export const EFFECT_ACTION_TYPES: readonly EffectActionType[]
  = Object.keys(EFFECT_ACTION_TYPE_TABLE) as EffectActionType[];

/**
 * Every action discriminator. Used by the validator to reject unknown action
 * types in externally-supplied schemas.
 */
export const LINKAGE_ACTION_TYPES: readonly LinkageActionType[] = [
  ...STATE_ACTION_TYPES,
  ...EFFECT_ACTION_TYPES
];

const STATE_ACTION_SET: ReadonlySet<string> = new Set(STATE_ACTION_TYPES);

/**
 * Narrows an action to the state family — folded into `RuntimeFieldState` by
 * the state lane, skipped by the effect lane.
 */
export function isStateAction(action: FieldLinkageAction): action is StateAction {
  return STATE_ACTION_SET.has(action.type);
}

/**
 * Narrows an action to the effect family — fired by the side-effect lane,
 * skipped by the state lane. The complement of {@link isStateAction} over the
 * closed {@link FieldLinkageAction} union, which is sound because
 * {@link STATE_ACTION_TYPE_TABLE} is compile-checked to be complete.
 */
export function isEffectAction(action: FieldLinkageAction): action is EffectAction {
  return !STATE_ACTION_SET.has(action.type);
}

/**
 * State actions that produce or alter form-data state. They are only meaningful
 * on keyed leaf fields (those that contribute a value); the validator and the
 * action editor both reject them on non-keyed targets. A deliberate subset (no
 * completeness claim), unlike the derived lists above.
 */
export const KEYED_ONLY_ACTIONS: ReadonlySet<LinkageActionType> = new Set<LinkageActionType>([
  "require",
  "optional",
  "assign"
]);

/**
 * Which rule scope each trigger kind may appear in. Complete over
 * {@link LinkageTriggerKind} (compile-checked), so adding a trigger kind forces
 * a scope decision here. Field events ride a field's own DOM hooks; lifecycle
 * moments belong to the form; `condition` (a level signal) is valid in both.
 */
const TRIGGER_KIND_SCOPE_TABLE: Record<LinkageTriggerKind, "both" | "field" | "form"> = {
  condition: "both",
  change: "field",
  focus: "field",
  blur: "field",
  click: "field",
  load: "form",
  beforeSubmit: "form",
  afterSubmit: "form"
};

const TRIGGER_KINDS = Object.keys(TRIGGER_KIND_SCOPE_TABLE) as LinkageTriggerKind[];

/**
 * Trigger kinds valid on a **field** (leaf / container) rule.
 */
export const FIELD_TRIGGER_KINDS: readonly LinkageTriggerKind[]
  = TRIGGER_KINDS.filter(kind => TRIGGER_KIND_SCOPE_TABLE[kind] !== "form");

/**
 * Trigger kinds valid on a **form-scope** rule. The form has no self field to
 * derive state for, so its rules carry effect actions only (enforced by the
 * validator).
 */
export const FORM_TRIGGER_KINDS: readonly LinkageTriggerKind[]
  = TRIGGER_KINDS.filter(kind => TRIGGER_KIND_SCOPE_TABLE[kind] !== "field");

/**
 * Field-event edge triggers — the kinds dispatched imperatively from a field's
 * DOM events (as opposed to the value-derived `condition` and form-lifecycle
 * triggers).
 */
export const FIELD_EVENT_TRIGGER_KINDS: readonly LinkageTriggerKind[]
  = TRIGGER_KINDS.filter(kind => TRIGGER_KIND_SCOPE_TABLE[kind] === "field");

const FIELD_EVENT_TRIGGER_SET: ReadonlySet<string> = new Set(FIELD_EVENT_TRIGGER_KINDS);

/**
 * Whether a trigger is a field DOM event (`change` / `focus` / `blur` /
 * `click`) — the triggers the renderer wires to a field's own events.
 */
export function isFieldEventTriggerKind(kind: LinkageTriggerKind): boolean {
  return FIELD_EVENT_TRIGGER_SET.has(kind);
}

/**
 * The allowed `alert` effect levels, mirroring antd's alert / message levels.
 * Complete over {@link LinkageAlertLevel} (compile-checked).
 */
const ALERT_LEVEL_TABLE: Record<LinkageAlertLevel, true> = {
  info: true,
  success: true,
  warning: true,
  error: true
};

export const ALERT_LEVELS: readonly LinkageAlertLevel[]
  = Object.keys(ALERT_LEVEL_TABLE) as LinkageAlertLevel[];
