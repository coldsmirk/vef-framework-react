import type { FC } from "react";

import type { FieldComponentProps, FieldDefinition, FieldOptionSource, PropertiesDescriptor, SelectField } from "../../types";

import { Select } from "@vef-framework-react/components";

import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { allowClearEntry, requiredEntry, sizeEntry } from "../field-entries";

const selectStyle = { width: "100%" } as const;

const SelectInput: FC<FieldComponentProps<SelectField, string | number | undefined>> = ({
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
      label={field.label ?? "下拉选择"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <Select
        allowClear={field.allowClear}
        disabled={disabled}
        id={domId}
        loading={loading}
        notFoundContent={error && options.length === 0 ? "选项加载失败" : undefined}
        options={options}
        placeholder={field.placeholder}
        showSearch={field.showSearch}
        size={field.size}
        status={errors?.length || error ? "error" : undefined}
        style={selectStyle}
        value={value === "" || value === undefined ? undefined : value}
        onChange={(next: string | number | undefined) => onChange(next ?? "")}
      />
    </FieldShell>
  );
};

const selectProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<SelectField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<SelectField, string | undefined>({
        id: "placeholder",
        label: "占位符",
        type: "text",
        read: field => field.placeholder,
        write: (field, placeholder) => { return { ...field, placeholder }; }
      }),
      definePropertyEntry<SelectField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      }),
      sizeEntry<SelectField>()
    ]
  },
  {
    id: "options",
    label: "选项",
    tab: "props",
    entries: [
      definePropertyEntry<SelectField, FieldOptionSource | undefined>({
        id: "options",
        label: "可选项",
        type: "options-editor",
        read: field => field.dataSource,
        write: (field, dataSource) => { return { ...field, dataSource }; }
      }),
      allowClearEntry<SelectField>(),
      definePropertyEntry<SelectField, boolean | undefined>({
        id: "showSearch",
        label: "可搜索",
        type: "checkbox",
        read: field => field.showSearch,
        write: (field, showSearch) => { return { ...field, showSearch: showSearch === true }; }
      })
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [requiredEntry<SelectField>()]
  }
];

export const selectFieldDefinition: FieldDefinition = defineFieldDefinition<SelectField, string | number | undefined>({
  config: {
    type: "select",
    name: "下拉选择",
    group: "selection",
    keyed: true,
    icon: "chevron-down",
    create: () => {
      return {
        type: "select",
        label: "下拉选择",
        dataSource: { kind: "static", options: [] }
      };
    }
  },
  Component: SelectInput,
  properties: selectProperties
});
