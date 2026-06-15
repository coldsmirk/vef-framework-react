import type { ChangeEvent, FC } from "react";

import type { FieldComponentProps, FieldDefinition, PropertiesDescriptor, TextareaField } from "../../types";

import { Input } from "@vef-framework-react/components";

import { FieldShell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import {
  allowClearEntry,
  inputMaxLengthEntry,
  maxLengthEntry,
  messageEntry,
  minLengthEntry,
  requiredEntry,
  sizeEntry
} from "../field-entries";

const DEFAULT_ROWS = 3;

const TextareaInput: FC<FieldComponentProps<TextareaField, string>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = "",
  onChange
}) => {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(event.target.value);
  };

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "多行文本"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <Input.TextArea
        allowClear={field.allowClear}
        autoSize={field.autoSize}
        disabled={disabled}
        id={domId}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        rows={field.rows ?? DEFAULT_ROWS}
        showCount={field.showCount}
        size={field.size}
        status={errors?.length ? "error" : undefined}
        value={value}
        onChange={handleChange}
      />
    </FieldShell>
  );
};

const textareaProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<TextareaField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<TextareaField, string | undefined>({
        id: "placeholder",
        label: "占位符",
        type: "text",
        read: field => field.placeholder,
        write: (field, placeholder) => { return { ...field, placeholder }; }
      }),
      definePropertyEntry<TextareaField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      }),
      definePropertyEntry<TextareaField, number | undefined>({
        id: "rows",
        label: "行数",
        type: "number",
        read: field => field.rows,
        write: (field, rows) => { return { ...field, rows }; }
      })
    ]
  },
  {
    id: "appearance",
    label: "外观",
    tab: "props",
    entries: [
      sizeEntry<TextareaField>(),
      definePropertyEntry<TextareaField, boolean | undefined>({
        id: "autoSize",
        label: "高度自适应",
        type: "checkbox",
        read: field => field.autoSize,
        write: (field, autoSize) => { return { ...field, autoSize: autoSize === true }; }
      }),
      allowClearEntry<TextareaField>(),
      inputMaxLengthEntry<TextareaField>(),
      definePropertyEntry<TextareaField, boolean | undefined>({
        id: "showCount",
        label: "显示字数",
        type: "checkbox",
        read: field => field.showCount,
        write: (field, showCount) => { return { ...field, showCount: showCount === true }; }
      })
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [
      requiredEntry<TextareaField>(),
      minLengthEntry<TextareaField>(),
      maxLengthEntry<TextareaField>(),
      messageEntry<TextareaField>()
    ]
  }
];

export const textareaFieldDefinition: FieldDefinition = defineFieldDefinition<TextareaField, string>({
  config: {
    type: "textarea",
    name: "多行文本",
    group: "basic-input",
    keyed: true,
    icon: "text",
    create: () => {
      return { type: "textarea", label: "多行文本" };
    }
  },
  Component: TextareaInput,
  properties: textareaProperties
});
