import type { ColumnDataType, FormField, PropertyEntry, PropertyEntryOption, Validatable } from "../types";

import { definePropertyEntry } from "../types";

/**
 * Shared property-entry factories for the field library. Several leaf fields
 * declare byte-identical validation entries whose `write` lens carries the
 * load-bearing `validate` merge contract (`{ ...field.validate, [key]: value }`);
 * centralising them here keeps that contract in one place instead of transcribed
 * per field, where it can drift. The same applies to a handful of appearance /
 * config entries that recur identically across fields (size / allowClear / input
 * maxLength / option direction) — they live here too. Entries that vary per field
 * (label / placeholder / helperText, whose copy differs) stay inline, where a
 * factory would obscure more than it saves.
 */

type ValidatableField = FormField & Validatable;

/**
 * Fields carrying a three-step antd control `size`. Constrains the generic so the
 * shared {@link sizeEntry} read/write lens type-checks without enumerating every
 * adopter.
 */
type SizedField = FormField & { size?: "small" | "middle" | "large" };

/**
 * Fields carrying a `allowClear` toggle (the clear affordance).
 */
type ClearableField = FormField & { allowClear?: boolean };

/**
 * Fields carrying a top-level `maxLength` input cap (distinct from
 * `validate.maxLength`).
 */
type MaxLengthInputField = FormField & { maxLength?: number };

/**
 * Fields whose options lay out along a `direction` axis (radio / checkbox group).
 */
type DirectionalField = FormField & { direction?: "horizontal" | "vertical" };

/**
 * The "必填字段" checkbox — toggles `validate.required` with a `=== true`
 * coercion, merged into the existing `validate` object. Identical across every
 * keyed leaf field.
 */
export function requiredEntry<F extends ValidatableField>(): PropertyEntry {
  return definePropertyEntry<F, boolean | undefined>({
    id: "required",
    label: "必填字段",
    type: "checkbox",
    read: field => field.validate?.required,
    write: (field, required) => { return { ...field, validate: { ...field.validate, required: required === true } }; }
  });
}

/**
 * The "最少字符数" entry — merges `validate.minLength`. Identical across the
 * string fields (textfield / code-editor / textarea).
 */
export function minLengthEntry<F extends ValidatableField>(): PropertyEntry {
  return definePropertyEntry<F, number | undefined>({
    id: "minLength",
    label: "最少字符数",
    type: "number",
    read: field => field.validate?.minLength,
    write: (field, minLength) => { return { ...field, validate: { ...field.validate, minLength } }; }
  });
}

/**
 * The "最多字符数" entry — merges `validate.maxLength`. Identical across the
 * string fields (textfield / code-editor / textarea).
 */
export function maxLengthEntry<F extends ValidatableField>(): PropertyEntry {
  return definePropertyEntry<F, number | undefined>({
    id: "maxLength",
    label: "最多字符数",
    type: "number",
    read: field => field.validate?.maxLength,
    write: (field, maxLength) => { return { ...field, validate: { ...field.validate, maxLength } }; }
  });
}

/**
 * The "校验下限" entry — merges `validate.min`, the submit-time lower bound.
 * Named `minValue` (not `min`) to disambiguate from NumberField's top-level
 * `min` input-clamp prop entry, which writes a different slot.
 */
export function minValueEntry<F extends ValidatableField>(): PropertyEntry {
  return definePropertyEntry<F, number | undefined>({
    id: "validateMin",
    label: "校验下限",
    type: "number",
    description: "提交时校验，低于此值报错",
    read: field => field.validate?.min,
    write: (field, min) => { return { ...field, validate: { ...field.validate, min } }; }
  });
}

/**
 * The "校验上限" entry — merges `validate.max`, the submit-time upper bound (the
 * counterpart to {@link minValueEntry}; distinct from the top-level `max` clamp).
 */
export function maxValueEntry<F extends ValidatableField>(): PropertyEntry {
  return definePropertyEntry<F, number | undefined>({
    id: "validateMax",
    label: "校验上限",
    type: "number",
    description: "提交时校验，高于此值报错",
    read: field => field.validate?.max,
    write: (field, max) => { return { ...field, validate: { ...field.validate, max } }; }
  });
}

/**
 * The "正则校验" entry — merges `validate.pattern`. The example placeholder
 * varies per field (e.g. textfield shows a phone-number example), so it is a
 * parameter; omit it for no placeholder.
 */
export function patternEntry<F extends ValidatableField>(placeholder?: string): PropertyEntry {
  return definePropertyEntry<F, string | undefined>({
    id: "pattern",
    label: "正则校验",
    type: "text",
    placeholder,
    read: field => field.validate?.pattern,
    write: (field, pattern) => { return { ...field, validate: { ...field.validate, pattern } }; }
  });
}

/**
 * The "校验提示" entry — merges `validate.message`, the optional override for the
 * default constraint-failure text. Identical across every validatable field.
 */
export function messageEntry<F extends ValidatableField>(): PropertyEntry {
  return definePropertyEntry<F, string | undefined>({
    id: "message",
    label: "校验提示",
    type: "text",
    placeholder: "可选 — 覆盖默认校验文案",
    read: field => field.validate?.message,
    write: (field, message) => { return { ...field, validate: { ...field.validate, message } }; }
  });
}

/**
 * The "尺寸" entry — the antd three-step control size (small / middle / large),
 * shared by the text / number / select / button fields. Mobile controls have no
 * size token, so this is a PC-only visual scale on every adopter.
 */
export function sizeEntry<F extends SizedField>(): PropertyEntry {
  return definePropertyEntry<F, "small" | "middle" | "large" | undefined>({
    id: "size",
    label: "尺寸",
    type: "select",
    options: [
      { value: "small", label: "小" },
      { value: "middle", label: "中" },
      { value: "large", label: "大" }
    ],
    read: field => field.size,
    write: (field, size) => { return { ...field, size }; }
  });
}

/**
 * The "允许清除" entry — toggles the one-click clear affordance with a `=== true`
 * coercion. Mirrors the inline lens SelectField already uses; shared by the text
 * fields that newly adopt it.
 */
export function allowClearEntry<F extends ClearableField>(): PropertyEntry {
  return definePropertyEntry<F, boolean | undefined>({
    id: "allowClear",
    label: "允许清除",
    type: "checkbox",
    read: field => field.allowClear,
    write: (field, allowClear) => { return { ...field, allowClear: allowClear === true }; }
  });
}

/**
 * The "最大输入长度" entry — the top-level `maxLength` input cap. Its entry id is
 * `inputMaxLength` (not `maxLength`) so it never collides with the validation-tab
 * {@link maxLengthEntry} on the same field, even though both write `maxLength` /
 * `validate.maxLength` respectively.
 */
export function inputMaxLengthEntry<F extends MaxLengthInputField>(): PropertyEntry {
  return definePropertyEntry<F, number | undefined>({
    id: "inputMaxLength",
    label: "最大输入长度",
    type: "number",
    description: "输入时硬上限，区别于提交校验规则",
    read: field => field.maxLength,
    write: (field, maxLength) => { return { ...field, maxLength }; }
  });
}

/**
 * The "排列方向" entry — lays a choice field's options horizontally or vertically.
 * Byte-identical across the radio and checkbox-group fields.
 */
export function optionDirectionEntry<F extends DirectionalField>(): PropertyEntry {
  return definePropertyEntry<F, "horizontal" | "vertical" | undefined>({
    id: "direction",
    label: "排列方向",
    type: "select",
    options: [
      { value: "horizontal", label: "横向" },
      { value: "vertical", label: "纵向" }
    ],
    read: field => field.direction,
    write: (field, direction) => { return { ...field, direction }; }
  });
}

/**
 * Fields exposing a table-storage column-type override (`columnType`).
 */
type ColumnTypedField = FormField & { columnType?: ColumnDataType };

/**
 * The "数据库列类型" override — pins a field's `columnType` for table storage when
 * its widget cannot deterministically infer one (number → integer/decimal,
 * select/radio → string/integer). The "自动" sentinel (empty) clears the override
 * so the designer infers from the widget. Each adopter passes the concrete
 * choices its widget allows; "自动" is prepended here so it stays consistent.
 */
export function columnTypeEntry<F extends ColumnTypedField>(options: PropertyEntryOption[]): PropertyEntry {
  return definePropertyEntry<F, string>({
    id: "columnType",
    label: "数据库列类型",
    type: "select",
    description: "table 存储模式下该字段的列类型；留空按控件自动推断",
    options: [{ value: "", label: "自动(按控件推断)" }, ...options],
    read: field => field.columnType ?? "",
    write: (field, value) => { return { ...field, columnType: value === "" ? undefined : (value as ColumnDataType) }; }
  });
}
