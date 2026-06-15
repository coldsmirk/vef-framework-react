import type { ScopePath } from "../../../../engine/schema/walk";
import type {
  EffectActionType,
  FormDataSource,
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

export const operatorOptions: Array<OptionItem<LinkageOperator>> = [
  { value: "eq", label: "等于" },
  { value: "ne", label: "不等于" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "contains", label: "包含" },
  { value: "empty", label: "为空" },
  { value: "notEmpty", label: "不为空" }
];

const TRIGGER_LABELS: Record<LinkageTriggerKind, string> = {
  condition: "满足条件",
  change: "值变化时",
  focus: "获得焦点",
  blur: "失去焦点",
  click: "点击时",
  load: "表单加载时",
  beforeSubmit: "提交前",
  afterSubmit: "提交后"
};

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
  set_field: "设置字段",
  set_variable: "设置变量",
  refresh_data_source: "刷新数据源",
  alert: "提示消息",
  api_call: "调用接口",
  navigate: "页面跳转",
  submit: "提交表单",
  reset: "重置表单"
};

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
 * target is narrowed to {@link CONTAINER_STATE_ACTIONS}. Effect actions are
 * always available.
 */
export function actionOptionsFor(args: {
  triggerKind: LinkageTriggerKind;
  isTargetKeyed: boolean;
  allowStateActions: boolean;
  isContainerTarget?: boolean;
}): Array<OptionItem<LinkageActionType>> {
  const stateOptions = args.allowStateActions && args.triggerKind === "condition"
    ? stateActionOptions.filter(option => {
        if (args.isContainerTarget) {
          return CONTAINER_STATE_ACTIONS.has(option.value);
        }

        return args.isTargetKeyed || !KEYED_ONLY_ACTIONS.has(option.value);
      })
    : [];

  return [...stateOptions, ...effectActionOptions];
}

export interface SourceFieldOption {
  value: string;
  label: string;
}

interface SourceCandidate {
  key?: string;
  label?: string;
  type: string;
}

/**
 * Collect the field candidates a linkage rule may reference, limited to the
 * scopes the predicate accepts — a field rule's own value scope, or the root
 * scope for form-level rules. Shared by the field and form linkage entries,
 * which then narrow the candidates into source / target option lists via
 * {@link getSourceFieldOptions} (so one walk feeds both lists).
 */
export function collectSourceCandidates(
  layer: PresentationLayer,
  inScope: (scope: ScopePath) => boolean
): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];

  walkFields(layer, (candidate, scope) => {
    if (inScope(scope)) {
      candidates.push({
        key: isKeyedField(candidate) ? candidate.key : undefined,
        label: candidate.label,
        type: candidate.type
      });
    }
  });

  return candidates;
}

/**
 * Builds the keyed-field dropdown options shared by a linkage rule's IF source
 * and its `set_field` target — both reference the same same-scope keyed fields.
 * Only keyed candidates appear. The field itself IS included: keying a rule off
 * its own value (e.g. "when my value == X → alert / refresh another field") is a
 * common need, and the runtime evaluates it like any other source. A genuine
 * cycle — a self-referential *state* dependency, or a cross-field loop — is
 * caught by the validator, not pruned here (the dropdown never tried to prevent
 * cross-field cycles either). Callers pass only same-scope candidates, since a
 * rule's source must live in the field's own value scope.
 */
export function getSourceFieldOptions(args: {
  components: SourceCandidate[];
}): SourceFieldOption[] {
  return args.components
    .filter((candidate): candidate is SourceCandidate & { key: string } => typeof candidate.key === "string" && candidate.key.length > 0)
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
export function getDataSourceOptions(dataSources: FormDataSource[] | undefined): SourceFieldOption[] {
  return (dataSources ?? []).map(source => {
    return { value: source.id, label: source.name.length > 0 ? source.name : source.id };
  });
}
