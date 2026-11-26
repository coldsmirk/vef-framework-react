import type { ScopePath } from "../../../../engine/schema/walk";
import type {
  EffectActionType,
  FormDataSource,
  FormField,
  LinkageActionType,
  LinkageOperator,
  LinkageTriggerKind,
  PresentationLayer,
  StateActionType
} from "../../../../types";

import { isKeyedField } from "../../../../engine/keys";
import {
  EFFECT_ACTION_TYPES,
  FIELD_TRIGGER_KINDS,
  FORM_TRIGGER_KINDS,
  isWritableTargetField,
  KEYED_ONLY_ACTIONS,
  LINKAGE_ACTION_TYPES,
  LINKAGE_OPERATORS,
  STATE_ACTION_TYPES
} from "../../../../engine/linkage";
import { walkFields } from "../../../../engine/schema/walk";

export interface OptionItem<T extends string> {
  value: T;
  label: string;
}

const OPERATOR_LABELS: Record<LinkageOperator, string> = {
  eq: "等于",
  ne: "不等于",
  gt: "大于",
  lt: "小于",
  gte: "大于等于",
  lte: "小于等于",
  contains: "包含",
  empty: "为空",
  notEmpty: "不为空"
};

export const operatorOptions: Array<OptionItem<LinkageOperator>> = LINKAGE_OPERATORS.map(value => {
  return { value, label: OPERATOR_LABELS[value] };
});

export function operatorLabelFor(operator: LinkageOperator): string {
  return OPERATOR_LABELS[operator];
}

const TRIGGER_LABELS: Record<LinkageTriggerKind, string> = {
  condition: "满足条件",
  change: "值变化时",
  commit: "输入完成时",
  focus: "获得焦点",
  blur: "失去焦点",
  click: "点击时",
  load: "表单加载时",
  beforeSubmit: "提交前",
  afterSubmit: "提交后"
};

export function triggerLabelFor(kind: LinkageTriggerKind): string {
  return TRIGGER_LABELS[kind];
}

const STATE_ACTION_LABELS: Record<StateActionType, string> = {
  show: "显示",
  hide: "隐藏",
  enable: "启用",
  disable: "禁用",
  require: "设为必填",
  optional: "取消必填",
  assign: "赋值",
  script: "脚本"
};

const EFFECT_ACTION_LABELS: Record<EffectActionType, string> = {
  set_fields: "设置字段",
  set_variable: "设置变量",
  refresh_data_source: "刷新数据源",
  alert: "提示消息",
  api_call: "调用接口",
  select_record: "选择记录",
  navigate: "页面跳转",
  submit: "提交表单",
  reset: "重置表单"
};

const ALL_ACTION_LABELS: Record<LinkageActionType, string> = {
  ...STATE_ACTION_LABELS,
  ...EFFECT_ACTION_LABELS
};

export function actionLabelFor(type: LinkageActionType): string {
  return ALL_ACTION_LABELS[type];
}

/**
 * Trigger dropdown options for a scope's allowed trigger kinds (field rules use
 * {@link FIELD_TRIGGER_KINDS}, the form-level panel {@link FORM_TRIGGER_KINDS}).
 */
export function triggerOptionsFor(kinds: readonly LinkageTriggerKind[]): Array<OptionItem<LinkageTriggerKind>> {
  return kinds.map(value => {
    return { value, label: TRIGGER_LABELS[value] };
  });
}

export const stateActionOptions: Array<OptionItem<StateActionType>> = STATE_ACTION_TYPES.map(value => {
  return { value, label: STATE_ACTION_LABELS[value] };
});

export const effectActionOptions: Array<OptionItem<EffectActionType>> = EFFECT_ACTION_TYPES.map(value => {
  return { value, label: EFFECT_ACTION_LABELS[value] };
});

export const alertLevelOptions: Array<OptionItem<"info" | "success" | "warning" | "error">> = [
  { value: "info", label: "信息" },
  { value: "success", label: "成功" },
  { value: "warning", label: "警告" },
  { value: "error", label: "错误" }
];

export const logicOptions: Array<OptionItem<"all" | "any">> = [
  { value: "all", label: "全部满足" },
  { value: "any", label: "任一满足" }
];

const TRIGGER_KIND_SET: ReadonlySet<string> = new Set<LinkageTriggerKind>([...FIELD_TRIGGER_KINDS, ...FORM_TRIGGER_KINDS]);

export function isLinkageOperator(value: unknown): value is LinkageOperator {
  return typeof value === "string" && LINKAGE_OPERATORS.includes(value as LinkageOperator);
}

export function isLinkageTriggerKind(value: unknown): value is LinkageTriggerKind {
  return typeof value === "string" && TRIGGER_KIND_SET.has(value);
}

export function isLinkageActionType(value: unknown): value is LinkageActionType {
  return typeof value === "string" && LINKAGE_ACTION_TYPES.includes(value as LinkageActionType);
}

export function isLogicValue(value: unknown): value is "all" | "any" {
  return value === "all" || value === "any";
}

export function operatorNeedsValue(operator: LinkageOperator): boolean {
  return operator !== "empty" && operator !== "notEmpty";
}

/**
 * The state actions a container target supports: visibility / interactivity
 * propagate to its descendants, while the value-touching actions (`require` /
 * `optional` / `assign`) and the per-field `script` patch are keyed-leaf-only
 * (mirroring the validator's `action_requires_keyed_leaf` policy).
 */
const CONTAINER_STATE_ACTIONS: ReadonlySet<LinkageActionType> = new Set<LinkageActionType>([
  "show",
  "hide",
  "enable",
  "disable"
]);

/**
 * The action-type palette for a rule. State actions are offered only when the
 * scope allows them (field / container scope, not form scope) AND the trigger
 * is a `condition` (state must be derived, not pulsed by an event); keyed-only
 * state actions are further dropped on a non-keyed target, and a container
 * target is narrowed to {@link CONTAINER_STATE_ACTIONS}. `api_call` and
 * `navigate` are gated by the host's wired `FormServices` capabilities
 * (defaulting to offered outside a `FormEditorProvider` so standalone unit
 * fixtures stay self-contained).
 */
export function actionOptionsFor(args: {
  triggerKind: LinkageTriggerKind;
  isTargetKeyed: boolean;
  allowStateActions: boolean;
  isContainerTarget?: boolean;
  hasRequest?: boolean;
  hasNavigate?: boolean;
}): Array<OptionItem<LinkageActionType>> {
  const stateOptions = args.allowStateActions && args.triggerKind === "condition"
    ? stateActionOptions.filter(option => {
        if (args.isContainerTarget) {
          return CONTAINER_STATE_ACTIONS.has(option.value);
        }

        return args.isTargetKeyed || !KEYED_ONLY_ACTIONS.has(option.value);
      })
    : [];

  const effectOptions = effectActionOptions.filter(option => {
    if (option.value === "api_call" && args.hasRequest === false) {
      return false;
    }

    return !(option.value === "navigate" && args.hasNavigate === false);
  });

  return [...stateOptions, ...effectOptions];
}

export interface SourceFieldOption {
  value: string;
  label: string;
}

/**
 * Collect the field candidates a linkage rule may reference, limited to the
 * scopes the predicate accepts — a field rule's own value scope, or the root
 * scope for form-level rules. Shared by the field and form linkage entries,
 * which then narrow the candidates into source / target option lists via
 * {@link getSourceFieldOptions} and {@link getTargetFieldOptions} (so one walk
 * feeds both lists).
 */
export function collectSourceCandidates(
  layer: PresentationLayer,
  inScope: (scope: ScopePath) => boolean
): FormField[] {
  const candidates: FormField[] = [];

  walkFields(layer, (candidate, scope) => {
    if (inScope(scope)) {
      candidates.push(candidate);
    }
  });

  return candidates;
}

/**
 * Builds the keyed-field dropdown options for a linkage rule's IF source.
 * Only keyed candidates appear. The field itself IS included: keying a rule off
 * its own value (e.g. "when my value == X → alert / refresh another field") is a
 * common need, and the runtime evaluates it like any other source. A genuine
 * cycle — a self-referential *state* dependency, or a cross-field loop — is
 * caught by the validator, not pruned here (the dropdown never tried to prevent
 * cross-field cycles either). Callers pass only same-scope candidates, since a
 * rule's source must live in the field's own value scope.
 */
export function getSourceFieldOptions(args: {
  components: readonly FormField[];
}): SourceFieldOption[] {
  return args.components
    .filter(isKeyedField)
    .map(candidate => {
      return {
        value: candidate.key,
        label: candidate.label ? `${candidate.label} · ${candidate.key}` : candidate.key
      };
    });
}

/**
 * Writable `set_fields` target options in scope, derived from the single
 * {@link isWritableTargetField} predicate shared with validation and runtime
 * execution.
 */
export function getTargetFieldOptions(args: {
  components: readonly FormField[];
}): SourceFieldOption[] {
  return args.components
    .filter(isWritableTargetField)
    .map(candidate => {
      return {
        value: candidate.key,
        label: candidate.label ? `${candidate.label} · ${candidate.key}` : candidate.key
      };
    });
}

/**
 * Data-source dropdown options for a `refresh_data_source` action — the form's
 * named data sources by id. An unnamed source falls back to its id as the label.
 */
export function getDataSourceOptions(dataSources: readonly FormDataSource[]): SourceFieldOption[] {
  return dataSources.map(source => {
    return { value: source.id, label: source.name.length > 0 ? source.name : source.id };
  });
}

/**
 * The source key a newly seeded condition should prefer: any option OTHER than
 * the rule's own field, or `undefined` when self is all there is. A
 * self-referencing condition ("show me when my own value is …") is almost
 * always a mistake, so the three places that seed one — creating a rule,
 * switching an expression back to visual mode, and switching a trigger back to
 * 满足条件 — must agree on that much.
 *
 * They deliberately differ on the no-sibling case, so the fallback stays with
 * the caller: creating a rule yields an edge rule instead of a pre-filled
 * self-condition, while the two switches fall back to self rather than refusing
 * an action the user explicitly asked for.
 */
export function seedSourceKey(
  options: ReadonlyArray<{ value: string }>,
  selfKey: string | undefined
): string | undefined {
  return options.find(option => option.value !== selfKey)?.value;
}
