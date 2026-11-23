import type { FC } from "react";

import type { FieldComponentProps, FieldDefinition, FieldOptionSource, MultiSelectField, PropertiesDescriptor } from "../../types";

import { filterOptionByLabel, Select } from "@vef-framework-react/components";

import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { allowClearEntry, requiredEntry, sizeEntry } from "../field-entries";

const selectStyle = { width: "100%" } as const;
const EMPTY_VALUE: Array<string | number> = [];

const MultiSelectInput: FC<FieldComponentProps<MultiSelectField, Array<string | number>>> = ({
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
  const maxCount = field.maxCount !== undefined && field.maxCount > 0 ? field.maxCount : undefined;

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "下拉多选"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <Select
        allowClear={field.allowClear}
        disabled={disabled}
        filterOption={filterOptionByLabel}
        id={domId}
        loading={loading}
        maxCount={maxCount}
        mode="multiple"
        notFoundContent={error && options.length === 0 ? "选项加载失败" : undefined}
        options={options}
        placeholder={field.placeholder}
        showSearch={field.showSearch === true}
        size={field.size}
        status={errors?.length || error ? "error" : undefined}
        style={selectStyle}
        value={Array.isArray(value) ? value : EMPTY_VALUE}
        onChange={(next: Array<string | number> | undefined) => onChange(next ?? [])}
      />
    </FieldShell>
  );
};

const multiSelectProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<MultiSelectField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<MultiSelectField, string | undefined>({
        id: "placeholder",
        label: "占位符",
        type: "text",
        read: field => field.placeholder,
        write: (field, placeholder) => { return { ...field, placeholder }; }
      }),
      definePropertyEntry<MultiSelectField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      }),
      sizeEntry<MultiSelectField>()
    ]
  },
  {
    id: "options",
    label: "选项",
    tab: "props",
    entries: [
      definePropertyEntry<MultiSelectField, FieldOptionSource | undefined>({
        id: "options",
        label: "可选项",
        type: "options-editor",
        read: field => field.dataSource,
        write: (field, dataSource) => { return { ...field, dataSource }; }
      }),
      allowClearEntry<MultiSelectField>(),
      definePropertyEntry<MultiSelectField, boolean | undefined>({
        id: "showSearch",
        label: "可搜索",
        type: "checkbox",
        read: field => field.showSearch,
        write: (field, showSearch) => { return { ...field, showSearch: showSearch === true }; }
      }),
      definePropertyEntry<MultiSelectField, number | undefined>({
        id: "maxCount",
        label: "最多可选数",
        type: "number",
        description: "留空或小于等于 0 表示不限制",
        read: field => field.maxCount,
        write: (field, maxCount) => { return { ...field, maxCount }; }
      })
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [requiredEntry<MultiSelectField>()]
  }
];

export const multiSelectFieldDefinition: FieldDefinition = defineFieldDefinition<MultiSelectField, Array<string | number>>({
  config: {
    type: "multi-select",
    name: "下拉多选",
    group: "selection",
    keyed: true,
    icon: "chevrons-up-down",
    create: () => {
      return {
        type: "multi-select",
        label: "下拉多选",
        dataSource: { kind: "static", options: [] }
      };
    }
  },
  Component: MultiSelectInput,
  properties: multiSelectProperties
});
