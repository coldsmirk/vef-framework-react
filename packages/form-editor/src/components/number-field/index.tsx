import type { FC } from "react";

import type { FieldComponentProps, FieldDefinition, NumberField, PropertiesDescriptor } from "../../types";

import { InputNumber } from "@vef-framework-react/components";

import { FieldShell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { maxValueEntry, messageEntry, minValueEntry, requiredEntry, sizeEntry } from "../field-entries";

const inputStyle = { width: "100%" } as const;

const NumberInput: FC<FieldComponentProps<NumberField, number | undefined>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}) => (
  <FieldShell
    domId={domId}
    errors={errors}
    helperText={field.helperText}
    label={field.label ?? "数字"}
    labelPosition={field.labelPosition ?? labelPosition}
    required={required ?? field.validate?.required}
  >
    <InputNumber
      controls={field.controls}
      disabled={disabled}
      id={domId}
      max={field.max}
      min={field.min}
      placeholder={field.placeholder}
      precision={field.precision}
      prefix={field.prefix}
      size={field.size}
      status={errors?.length ? "error" : undefined}
      step={field.step}
      style={inputStyle}
      suffix={field.suffix}
      value={value}
      onChange={next => onChange(typeof next === "number" ? next : undefined)}
    />
  </FieldShell>
);

const numberProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<NumberField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => {
          return { ...field, label };
        }
      }),
      definePropertyEntry<NumberField, string | undefined>({
        id: "placeholder",
        label: "占位符",
        type: "text",
        read: field => field.placeholder,
        write: (field, placeholder) => {
          return { ...field, placeholder };
        }
      }),
      definePropertyEntry<NumberField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => {
          return { ...field, helperText };
        }
      })
    ]
  },
  {
    id: "appearance",
    label: "外观",
    tab: "props",
    entries: [
      sizeEntry<NumberField>(),
      definePropertyEntry<NumberField, string | undefined>({
        id: "prefix",
        label: "前缀",
        type: "text",
        placeholder: "如 ¥",
        read: field => field.prefix,
        write: (field, prefix) => {
          return { ...field, prefix };
        }
      }),
      definePropertyEntry<NumberField, string | undefined>({
        id: "suffix",
        label: "后缀",
        type: "text",
        placeholder: "如 元 / %",
        read: field => field.suffix,
        write: (field, suffix) => {
          return { ...field, suffix };
        }
      }),
      definePropertyEntry<NumberField, boolean | undefined>({
        id: "controls",
        label: "显示步进按钮",
        type: "checkbox",
        read: field => field.controls,
        write: (field, controls) => {
          return { ...field, controls: controls === true };
        }
      })
    ]
  },
  {
    id: "range",
    label: "取值",
    tab: "props",
    entries: [
      definePropertyEntry<NumberField, number | undefined>({
        id: "min",
        label: "最小值",
        type: "number",
        read: field => field.min,
        write: (field, min) => {
          return { ...field, min };
        }
      }),
      definePropertyEntry<NumberField, number | undefined>({
        id: "max",
        label: "最大值",
        type: "number",
        read: field => field.max,
        write: (field, max) => {
          return { ...field, max };
        }
      }),
      definePropertyEntry<NumberField, number | undefined>({
        id: "step",
        label: "步长",
        type: "number",
        read: field => field.step,
        write: (field, step) => {
          return { ...field, step };
        }
      }),
      definePropertyEntry<NumberField, number | undefined>({
        id: "precision",
        label: "精度",
        type: "number",
        description: "保留的小数位数",
        read: field => field.precision,
        write: (field, precision) => {
          return { ...field, precision };
        }
      })
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [
      requiredEntry<NumberField>(),
      minValueEntry<NumberField>(),
      maxValueEntry<NumberField>(),
      messageEntry<NumberField>()
    ]
  }
];

export const numberFieldDefinition: FieldDefinition = defineFieldDefinition<NumberField, number | undefined>({
  config: {
    type: "number",
    name: "数字",
    group: "basic-input",
    keyed: true,
    icon: "hash",
    create: () => {
      return { type: "number", label: "数字" };
    }
  },
  Component: NumberInput,
  properties: numberProperties
});
