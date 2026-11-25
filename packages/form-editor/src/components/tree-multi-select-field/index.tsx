import type { FC } from "react";

import type {
  FieldComponentProps,
  FieldDefinition,
  FieldOptionSource,
  PropertiesDescriptor,
  TreeMultiSelectField
} from "../../types";

import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell, useFieldCell } from "../../render/parts/field-shell";
import { OptionTreeSelect } from "../../render/parts/option-tree-select";
import { resolveFieldPlaceholder } from "../../render/parts/placeholder";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { allowClearEntry, leafOnlyEntry, requiredEntry, sizeEntry } from "../field-entries";

const EMPTY_VALUE: Array<string | number> = [];

const TreeMultiSelectInput: FC<FieldComponentProps<TreeMultiSelectField, Array<string | number>>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}) => {
  const cell = useFieldCell();
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);

  const current = Array.isArray(value) ? value : EMPTY_VALUE;

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "树形多选"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <OptionTreeSelect
        multiple
        allowClear={field.allowClear}
        aria-labelledby={cell?.labelId}
        disabled={disabled}
        id={domId}
        leafOnly={field.leafOnly === true}
        loading={loading}
        notFoundContent={error && options.length === 0 ? "选项加载失败" : undefined}
        options={options}
        placeholder={resolveFieldPlaceholder(field)}
        popupMatchSelectWidth={cell ? false : undefined}
        showSearch={field.showSearch === true}
        size={field.size}
        status={errors?.length || error ? "error" : undefined}
        value={current}
        onChange={onChange}
      />
    </FieldShell>
  );
};

const treeMultiSelectProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<TreeMultiSelectField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<TreeMultiSelectField, string | undefined>({
        id: "placeholder",
        label: "占位符",
        type: "text",
        read: field => field.placeholder,
        write: (field, placeholder) => { return { ...field, placeholder }; }
      }),
      definePropertyEntry<TreeMultiSelectField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      }),
      sizeEntry<TreeMultiSelectField>()
    ]
  },
  {
    id: "options",
    label: "选项",
    tab: "props",
    entries: [
      definePropertyEntry<TreeMultiSelectField, FieldOptionSource | undefined>({
        id: "options",
        label: "可选项",
        type: "options-editor",
        read: field => field.dataSource,
        write: (field, dataSource) => { return { ...field, dataSource }; }
      }),
      leafOnlyEntry<TreeMultiSelectField>(),
      allowClearEntry<TreeMultiSelectField>(),
      definePropertyEntry<TreeMultiSelectField, boolean | undefined>({
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
    entries: [requiredEntry<TreeMultiSelectField>()]
  }
];

export const treeMultiSelectFieldDefinition: FieldDefinition = defineFieldDefinition<TreeMultiSelectField, Array<string | number>>({
  config: {
    type: "tree-multi-select",
    name: "树形多选",
    group: "selection",
    keyed: true,
    icon: "folder-tree",
    create: () => {
      return {
        type: "tree-multi-select",
        label: "树形多选",
        dataSource: { kind: "static", options: [] }
      };
    }
  },
  Component: TreeMultiSelectInput,
  properties: treeMultiSelectProperties
});
