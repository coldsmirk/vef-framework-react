import type { FC } from "react";

import type { FieldComponentProps, FieldDefinition, FieldOptionSource, PropertiesDescriptor, RadioField } from "../../types";

import { Radio, Spin } from "@vef-framework-react/components";

import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell } from "../../render/parts/field-shell";
import { OptionsStatus } from "../../render/parts/options-status";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { optionDirectionEntry, requiredEntry } from "../field-entries";

const RadioInput: FC<FieldComponentProps<RadioField, string | number | undefined>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}) => {
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "单选"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      {options.length > 0
        ? (
            <Spin spinning={loading}>
              <Radio.Group
                buttonStyle={field.buttonStyle}
                disabled={disabled}
                options={options}
                optionType={field.optionType}
                orientation={field.direction}
                value={value === "" ? undefined : value}
                onChange={event => onChange(event.target.value)}
              />
            </Spin>
          )
        : <OptionsStatus error={error} loading={loading} />}
    </FieldShell>
  );
};

const radioProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<RadioField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<RadioField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      })
    ]
  },
  {
    id: "options",
    label: "选项",
    tab: "props",
    entries: [
      definePropertyEntry<RadioField, FieldOptionSource | undefined>({
        id: "options",
        label: "可选项",
        type: "options-editor",
        read: field => field.dataSource,
        write: (field, dataSource) => { return { ...field, dataSource }; }
      }),
      definePropertyEntry<RadioField, "default" | "button" | undefined>({
        id: "optionType",
        label: "样式",
        type: "select",
        options: [
          { value: "default", label: "圆点" },
          { value: "button", label: "按钮组" }
        ],
        read: field => field.optionType,
        write: (field, optionType) => { return { ...field, optionType }; }
      }),
      definePropertyEntry<RadioField, "outline" | "solid" | undefined>({
        id: "buttonStyle",
        label: "按钮风格",
        type: "select",
        options: [
          { value: "outline", label: "描边" },
          { value: "solid", label: "填充" }
        ],
        visible: field => field.optionType === "button",
        read: field => field.buttonStyle,
        write: (field, buttonStyle) => { return { ...field, buttonStyle }; }
      }),
      optionDirectionEntry<RadioField>()
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [requiredEntry<RadioField>()]
  }
];

export const radioFieldDefinition: FieldDefinition = defineFieldDefinition<RadioField, string | number | undefined>({
  config: {
    type: "radio",
    name: "单选",
    group: "selection",
    keyed: true,
    icon: "circle-dot",
    create: () => {
      return {
        type: "radio",
        label: "单选",
        dataSource: { kind: "static", options: [] }
      };
    }
  },
  Component: RadioInput,
  properties: radioProperties
});
