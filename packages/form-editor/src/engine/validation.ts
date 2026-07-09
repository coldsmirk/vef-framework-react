import { isPlainObject } from "@vef-framework-react/shared";

/**
 * Structured validation issues shared by the schema validator
 * (`engine/schema/validate.ts`) and the linkage validator
 * (`engine/linkage/validator.ts`).
 *
 * Hosts program against `code` + `path` (stable, machine-readable); `message`
 * is the zh-CN product copy, produced exclusively through
 * {@link formatIssueMessage} so every user-facing string lives in this module.
 *
 * Severity policy:
 * - `"error"` — the schema is structurally broken (malformed envelope,
 * non-object rule / trigger / action, unknown types, duplicate ids / keys,
 * invalid key charset, state actions on edge triggers, dependency cycles).
 * The renderer / runtime cannot safely consume such a schema.
 * - `"warning"` — the schema is well-formed but incomplete or dangling (empty
 * `targetKey` / `variable` / expression sources, unresolved key or data-source
 * references, empty condition groups). The editor legitimately produces these
 * mid-authoring, so they must round-trip through export → import: a result is
 * `valid` as long as it carries no error-severity issue.
 */

/**
 * Stable machine-readable identifiers for every issue the validators emit.
 */
export type ValidationIssueCode
  // Schema envelope
  = | "schema_not_object"
    | "id_required"
    | "duplicate_id"
    | "version_unsupported"
    | "presentation_not_object"
    | "variables_invalid"
    | "data_sources_invalid"
  // Block tree structure
    | "block_not_object"
    | "children_not_array"
    | "tabs_empty"
    | "tab_malformed"
    | "type_required"
    | "unknown_field_type"
    | "key_required"
    | "stray_key"
    | "stray_key_on_container"
    | "duplicate_key"
    | "key_invalid_charset"
  // Layout properties
    | "span_invalid"
    | "flex_invalid"
    | "column_width_invalid"
    | "stack_invalid"
    | "gap_invalid"
    | "columns_invalid"
    | "variant_invalid"
    | "subform_variant_invalid"
    | "title_invalid"
    | "display_text_invalid"
    | "rows_bound_invalid"
    | "subform_table_column"
  // Static field validation rules
    | "validate_malformed"
    | "validate_range_invalid"
    | "pattern_invalid"
  // Option sources
    | "data_source_invalid"
    | "data_source_ref_unknown"
    | "request_malformed"
    | "request_incomplete"
  // Linkage
    | "linkage_malformed"
    | "rules_not_array"
    | "rule_malformed"
    | "trigger_malformed"
    | "trigger_kind_invalid"
    | "trigger_requires_keyed_leaf"
    | "condition_malformed"
    | "condition_kind_invalid"
    | "logic_invalid"
    | "condition_group_empty"
    | "operator_invalid"
    | "source_key_empty"
    | "source_key_unresolved"
    | "source_empty"
    | "actions_not_array"
    | "actions_empty"
    | "action_malformed"
    | "action_unknown_type"
    | "state_action_on_edge_trigger"
    | "state_action_on_form_scope"
    | "action_requires_keyed_leaf"
    | "defaults_requires_keyed_leaf"
    | "defaults_on_form_scope"
    | "default_hidden_unreachable"
    | "target_key_empty"
    | "target_key_unresolved"
    | "variable_empty"
    | "data_source_id_empty"
    | "value_malformed"
    | "alert_level_invalid"
    | "retrigger_invalid"
    | "retrigger_ignored"
    | "self_reference"
    | "cycle_detected";

export type ValidationSeverity = "error" | "warning";

/**
 * One problem found while validating a schema. `path` points at the offending
 * location (`presentations.pc.children[0].key`, `node[Field_1].linkage.rules[0]`,
 * …); `ruleId` is set on rule-scoped linkage issues whose rule id is known, so
 * the editor can map diagnostics onto rule cards.
 */
export interface ValidationIssue {
  path: string;
  code: ValidationIssueCode;
  severity: ValidationSeverity;
  message: string;
  ruleId?: string;
}

/**
 * Message parameters per param-bearing code. Codes absent from this interface
 * take no parameters.
 */
interface ValidationIssueParams {
  duplicate_id: { id: string };
  unknown_field_type: { type: string };
  key_required: { type: string };
  stray_key: { type: string };
  stray_key_on_container: { type: string };
  duplicate_key: { key: string };
  key_invalid_charset: { key: string };
  span_invalid: { max: number };
  columns_invalid: { max: number };
  display_text_invalid: { prop: string };
  validate_range_invalid: { lower: string; upper: string };
  data_source_ref_unknown: { id: string };
  trigger_kind_invalid: { kind: string };
  action_unknown_type: { type: string };
  state_action_on_edge_trigger: { type: string };
  state_action_on_form_scope: { type: string };
  action_requires_keyed_leaf: { type: string };
  source_key_unresolved: { key: string };
  target_key_unresolved: { key: string };
  cycle_detected: { cycle: string };
}

type ParamCode = keyof ValidationIssueParams;

type ParamlessCode = Exclude<ValidationIssueCode, ParamCode>;

/**
 * The issues the editor legitimately produces mid-authoring (incomplete or
 * dangling configuration). Everything else is an error.
 */
const WARNING_CODES: ReadonlySet<ValidationIssueCode> = new Set<ValidationIssueCode>([
  "data_source_ref_unknown",
  "request_incomplete",
  "condition_group_empty",
  "source_key_empty",
  "source_key_unresolved",
  "source_empty",
  "actions_empty",
  "target_key_empty",
  "target_key_unresolved",
  "variable_empty",
  "data_source_id_empty",
  "retrigger_ignored",
  "default_hidden_unreachable",
  "subform_table_column"
]);

const PARAMLESS_MESSAGES: Record<ParamlessCode, string> = {
  schema_not_object: "Schema 必须是对象",
  id_required: "id 必须为非空字符串",
  version_unsupported: "version 必须为 2",
  presentation_not_object: "必须是对象",
  variables_invalid: "variables 定义无效：需为对象数组，每项包含非空 id、合法的 name（字母 / 数字 / 下划线，不能以数字开头）、受支持的 type，且 name 唯一",
  data_sources_invalid: "dataSources 定义无效：需为对象数组，每项包含唯一非空 id、字符串 name 与合法的 kind（static / remote）定义",
  block_not_object: "节点必须是对象",
  children_not_array: "必须是数组",
  tabs_empty: "tabs 不能为空",
  tab_malformed: "标签页必须是对象且 label 为字符串",
  type_required: "type 必须为非空字符串",
  flex_invalid: "flex 配置无效：grow / shrink 须为非负数，basis 须为字符串",
  column_width_invalid: "columnWidth 必须为正数（表格子表单列的固定像素宽度）",
  stack_invalid: "stack 配置无效：width / minWidth / maxWidth 须为非负数值 + px/% 单位，align 须为 start/center/end",
  gap_invalid: "间距取值非法（需为预设档位或非负整数）",
  variant_invalid: "variant 必须为 \"card\" 或 \"collapse\"",
  subform_variant_invalid: "variant 必须为 \"stack\" 或 \"table\"",
  title_invalid: "title 必须为字符串",
  rows_bound_invalid: "行数限制无效：minRows / maxRows 须为非负整数且 minRows ≤ maxRows",
  subform_table_column: "表格子表单的列必须是绑定字段（不能是容器或展示 / 按钮类组件）",
  validate_malformed: "validate 必须是对象",
  pattern_invalid: "pattern 不是合法的正则表达式",
  data_source_invalid: "数据源定义无效：kind 须为 static / ref / remote 且结构完整",
  request_malformed: "request 必须是对象且 resource / action 为字符串",
  request_incomplete: "request 的 resource / action 尚未填写",
  linkage_malformed: "linkage 结构无效：必须是对象",
  rules_not_array: "rules 必须是数组",
  rule_malformed: "规则结构无效：必须是对象",
  trigger_malformed: "触发器结构无效：必须是包含 kind 的对象",
  trigger_requires_keyed_leaf: "kind \"change\" 只能用于 keyed 叶子字段",
  condition_malformed: "条件结构无效",
  condition_kind_invalid: "kind 不是受支持的条件类型",
  logic_invalid: "logic 必须为 \"all\" 或 \"any\"",
  condition_group_empty: "条件组没有子条件，规则不会生效",
  operator_invalid: "operator 不是受支持的联动操作符",
  source_key_empty: "sourceKey 尚未选择",
  source_empty: "表达式 / 脚本内容为空",
  actions_not_array: "actions 必须是数组",
  actions_empty: "规则没有任何动作，不会生效",
  action_malformed: "动作结构无效",
  defaults_requires_keyed_leaf: "defaults.required 只能用于 keyed 叶子字段",
  defaults_on_form_scope: "表单级联动不支持 defaults（表单没有自身字段）",
  default_hidden_unreachable: "默认隐藏但没有任何「显示」动作的规则，运行时将永远不可见",
  target_key_empty: "targetKey 尚未选择",
  variable_empty: "variable 尚未填写",
  data_source_id_empty: "dataSourceId 尚未选择",
  value_malformed: "取值结构无效：须为 literal 或 expression 形态",
  alert_level_invalid: "level 不是受支持的提示级别",
  retrigger_invalid: "retrigger 必须为 \"edge\" 或 \"always\"",
  retrigger_ignored: "retrigger 仅对条件触发生效，事件触发将忽略该配置",
  self_reference: "条件不能引用本节点自身（该规则会写入自身的值）"
};

/**
 * zh-CN templates for the param-bearing codes. `{name}` placeholders are
 * interpolated from the issue params; the overloads on
 * {@link formatIssueMessage} / {@link createIssue} keep every call site's
 * params typed per code via {@link ValidationIssueParams}.
 */
const PARAM_MESSAGES: Record<ParamCode, string> = {
  duplicate_id: "id 与其他节点重复：{id}",
  unknown_field_type: "字段类型 \"{type}\" 未在字段注册表中",
  key_required: "key 必须为非空字符串（\"{type}\" 是 keyed 类型）",
  stray_key: "key 不应出现（字段类型 \"{type}\" 不是 keyed 字段）",
  stray_key_on_container: "key 不应出现（\"{type}\" 是纯布局容器）",
  duplicate_key: "key 在同一作用域内重复：{key}",
  key_invalid_charset: "key 只能包含字母、数字和下划线：{key}",
  display_text_invalid: "{prop} 必须为字符串",
  span_invalid: "span 必须为 1..{max} 的整数",
  columns_invalid: "columns 必须为 1 到 {max} 之间的整数",
  validate_range_invalid: "{lower} 不能大于 {upper}",
  data_source_ref_unknown: "引用的数据源不存在：{id}",
  trigger_kind_invalid: "kind \"{kind}\" 不能用于该作用域",
  action_unknown_type: "type \"{type}\" 不是受支持的联动动作",
  state_action_on_edge_trigger: "\"{type}\" 是状态动作，只能用于条件触发",
  state_action_on_form_scope: "\"{type}\" 是状态动作，不能用于表单级联动",
  action_requires_keyed_leaf: "\"{type}\" 只能用于 keyed 叶子字段",
  source_key_unresolved: "sourceKey 未指向同一作用域内已存在的 keyed 节点：{key}",
  target_key_unresolved: "targetKey 未指向同一作用域内已存在的 keyed 节点：{key}",
  cycle_detected: "联动规则存在循环依赖：{cycle}"
};

function isParamCode(code: ValidationIssueCode): code is ParamCode {
  return Object.hasOwn(PARAM_MESSAGES, code);
}

function renderMessage(code: ValidationIssueCode, params: unknown): string {
  if (!isParamCode(code)) {
    return PARAMLESS_MESSAGES[code];
  }

  // The public overloads guarantee `params` carries the placeholders this
  // code's template reads; the cast re-associates the pair the overload
  // signatures erased.
  const values = params as Record<string, number | string>;

  return PARAM_MESSAGES[code].replaceAll(
    /\{(?<name>\w+)\}/g,
    (_match, name: string) => String(values[name])
  );
}

/**
 * Render the zh-CN message for an issue code. The single place every
 * user-facing validation string is produced.
 */
export function formatIssueMessage<C extends ParamCode>(code: C, params: ValidationIssueParams[C]): string;
export function formatIssueMessage(code: ParamlessCode): string;

export function formatIssueMessage(code: ValidationIssueCode, params?: unknown): string {
  return renderMessage(code, params);
}

/**
 * One issue rendered as `path：message` (or the bare message when it carries
 * no path) — the plain-text line format shared by the apply pipeline's
 * error/warning reports and the dialogs' `$vef`-less fallbacks.
 */
export function formatIssueLine(issue: ValidationIssue): string {
  return issue.path.length > 0 ? `${issue.path}：${issue.message}` : issue.message;
}

/**
 * Build a {@link ValidationIssue}, deriving `severity` and `message` from the
 * central tables so emit sites only state location + code (+ params / rule id).
 */
export function createIssue<C extends ParamCode>(
  path: string,
  code: C,
  params: ValidationIssueParams[C],
  ruleId?: string
): ValidationIssue;
export function createIssue(path: string, code: ParamlessCode, params?: undefined, ruleId?: string): ValidationIssue;

export function createIssue(
  path: string,
  code: ValidationIssueCode,
  params?: unknown,
  ruleId?: string
): ValidationIssue {
  return {
    path,
    code,
    severity: WARNING_CODES.has(code) ? "warning" : "error",
    message: renderMessage(code, params),
    ...ruleId !== undefined && { ruleId }
  };
}

/**
 * Whether any issue is error-severity — the complement of a result's `valid`.
 */
export function hasErrorIssues(issues: readonly ValidationIssue[]): boolean {
  return issues.some(issue => issue.severity === "error");
}

/**
 * Null-safe plain-object guard narrowed to a string-keyed record so the
 * validators can read members of untrusted input without casts. Delegates to
 * the shared `isPlainObject` (rejects `null`, arrays, and class instances);
 * re-typed here because the shared predicate narrows only to `object`.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value);
}

/**
 * Shape-check a {@link "../types/data-source"!RemoteDataSourceRequest}. Used for
 * `api_call` linkage actions, form-global remote data sources, and inline
 * `remote` option sources. A non-object request or non-string `resource` /
 * `action` is structural breakage (error); empty strings are the editor's
 * freshly-seeded state and only warn.
 */
export function validateRemoteRequest(request: unknown, path: string, ruleId?: string): ValidationIssue[] {
  if (!isRecord(request)) {
    return [createIssue(path, "request_malformed", undefined, ruleId)];
  }

  const issues: ValidationIssue[] = [];
  const { action, resource } = request;

  if (typeof resource !== "string") {
    issues.push(createIssue(`${path}.resource`, "request_malformed", undefined, ruleId));
  } else if (resource.length === 0) {
    issues.push(createIssue(`${path}.resource`, "request_incomplete", undefined, ruleId));
  }

  if (typeof action !== "string") {
    issues.push(createIssue(`${path}.action`, "request_malformed", undefined, ruleId));
  } else if (action.length === 0) {
    issues.push(createIssue(`${path}.action`, "request_incomplete", undefined, ruleId));
  }

  return issues;
}
