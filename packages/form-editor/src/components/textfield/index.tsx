import type { DynamicIconName } from "@vef-framework-react/components";
import type { ChangeEvent, FC } from "react";

import type { FieldComponentProps, FieldDefinition, PropertiesDescriptor, TextfieldField } from "../../types";

import { Input } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";
import { FieldShell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import {
  allowClearEntry,
  inputMaxLengthEntry,
  maxLengthEntry,
  messageEntry,
  minLengthEntry,
  patternEntry,
  requiredEntry,
  sizeEntry
} from "../field-entries";

/**
 * Renderer for the textfield. Reads `placeholder` and the optional
 * `helperText` from the discriminated `TextfieldField` shape. The required
 * marker tracks the live `required` prop (static `validate.required` merged
 * with runtime linkage by the form renderer), falling back to the static flag
 * at design time.
 */
export const Textfield: FC<FieldComponentProps<TextfieldField, string>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = "",
  onChange
}) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value);
  };

  // Password mode masks the value via antd's `Input.Password`; both controls
  // share the `InputProps` surface (prefix / size / allowClear / maxLength).
  const Control = field.inputType === "password" ? Input.Password : Input;

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "文本框"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <Control
        allowClear={field.allowClear}
        disabled={disabled}
        id={domId}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        prefix={field.prefixIcon ? <EditorIcon name={field.prefixIcon} /> : undefined}
        size={field.size}
        status={errors?.length ? "error" : undefined}
        value={value}
        onChange={handleChange}
      />
    </FieldShell>
  );
};

/**
 * Property descriptor for the textfield.
 *
 * Tab assignment:
 * - `general` and `appearance` → 属性 tab (default `props`)
 * - `validation` → 校验 tab
 */
const textfieldProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<TextfieldField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<TextfieldField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        placeholder: "可选 — 字段下方提示",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      }),
      definePropertyEntry<TextfieldField, "text" | "password" | undefined>({
        id: "inputType",
        label: "输入类型",
        type: "select",
        options: [
          { value: "text", label: "普通文本" },
          { value: "password", label: "密码" }
        ],
        read: field => field.inputType,
        write: (field, inputType) => { return { ...field, inputType }; }
      })
    ]
  },
  {
    id: "appearance",
    label: "外观",
    tab: "props",
    entries: [
      definePropertyEntry<TextfieldField, string | undefined>({
        id: "placeholder",
        label: "占位符",
        type: "text",
        placeholder: "请输入",
        read: field => field.placeholder,
        write: (field, placeholder) => { return { ...field, placeholder }; }
      }),
      definePropertyEntry<TextfieldField, DynamicIconName | undefined>({
        id: "prefixIcon",
        label: "前缀图标",
        type: "icon",
        read: field => field.prefixIcon,
        write: (field, prefixIcon) => { return { ...field, prefixIcon }; }
      }),
      sizeEntry<TextfieldField>(),
      allowClearEntry<TextfieldField>(),
      inputMaxLengthEntry<TextfieldField>()
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [
      requiredEntry<TextfieldField>(),
      minLengthEntry<TextfieldField>(),
      maxLengthEntry<TextfieldField>(),
      patternEntry<TextfieldField>(String.raw`如 ^1\d{10}$`),
      messageEntry<TextfieldField>()
    ]
  }
];

export const textfieldDefinition: FieldDefinition = defineFieldDefinition<TextfieldField, string>({
  config: {
    type: "textfield",
    name: "文本框",
    group: "basic-input",
    keyed: true,
    icon: "type",
    // Returns type-specific defaults only. The store fills `id` / `key`
    // (`generateUniqueKey` gives each new textfield a unique data-binding key).
    // Omitting `span` here means full row.
    create: () => {
      return {
        type: "textfield",
        label: "文本框"
      };
    }
  },
  Component: Textfield,
  properties: textfieldProperties
});
