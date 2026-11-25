import type { FC } from "react";

import type {
  FieldComponentProps,
  FieldDefinition,
  FieldOptionSource,
  PropertiesDescriptor,
  TreeSelectField
} from "../../types";

import { TreeSelect } from "@vef-framework-react/components";
import { useMemo } from "react";

import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell, useFieldCell } from "../../render/parts/field-shell";
import {
  filterOptionByLabelOrDescription,
  toAntdTreeData,
  useTreeSelectExpansion
} from "../../render/parts/option-content";
import { resolveFieldPlaceholder } from "../../render/parts/placeholder";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { allowClearEntry, columnTypeEntry, requiredEntry, sizeEntry } from "../field-entries";

const treeSelectStyle = { width: "100%" } as const;
const TREE_LINE = { showLeafIcon: false } as const;
const EMPTY_SELECTED: Array<string | number> = [];

const TreeSelectInput: FC<FieldComponentProps<TreeSelectField, string | number | undefined>> = ({
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

  const normalizedValue = value === "" || value === null || value === undefined ? undefined : value;
  const selectedValues = useMemo<Array<string | number>>(
    () => normalizedValue === undefined ? EMPTY_SELECTED : [normalizedValue],
    [normalizedValue]
  );
  const treeData = useMemo(
    () => toAntdTreeData(options, { leafOnly: field.leafOnly === true, checkable: false }),
    [field.leafOnly, options]
  );
  const {
    expandedKeys,
    onOpenChange,
    onSearch,
    onTreeExpand,
    searchValue
  } = useTreeSelectExpansion(options, selectedValues);

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "树形选择"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <TreeSelect
        allowClear={field.allowClear}
        aria-labelledby={cell?.labelId}
        disabled={disabled}
        filterTreeNode={filterOptionByLabelOrDescription}
        id={domId}
        loading={loading}
        notFoundContent={error && options.length === 0 ? "选项加载失败" : undefined}
        placeholder={resolveFieldPlaceholder(field)}
        popupMatchSelectWidth={cell ? false : undefined}
        searchValue={searchValue}
        showSearch={field.showSearch === true}
        size={field.size}
        status={errors?.length || error ? "error" : undefined}
        style={treeSelectStyle}
        treeData={treeData}
        treeExpandedKeys={expandedKeys}
        treeLine={TREE_LINE}
        treeNodeLabelProp="label"
        value={normalizedValue}
        onChange={(next: string | number | undefined) => onChange(next ?? "")}
        onOpenChange={onOpenChange}
        onSearch={onSearch}
        onTreeExpand={onTreeExpand}
      />
    </FieldShell>
  );
};

const treeSelectProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<TreeSelectField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<TreeSelectField, string | undefined>({
        id: "placeholder",
        label: "占位符",
        type: "text",
        read: field => field.placeholder,
        write: (field, placeholder) => { return { ...field, placeholder }; }
      }),
      definePropertyEntry<TreeSelectField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      }),
      sizeEntry<TreeSelectField>()
    ]
  },
  {
    id: "options",
    label: "选项",
    tab: "props",
    entries: [
      definePropertyEntry<TreeSelectField, FieldOptionSource | undefined>({
        id: "options",
        label: "可选项",
        type: "options-editor",
        read: field => field.dataSource,
        write: (field, dataSource) => { return { ...field, dataSource }; }
      }),
      definePropertyEntry<TreeSelectField, boolean | undefined>({
        id: "leafOnly",
        label: "仅可选末级",
        type: "checkbox",
        description: "开启后仅允许选择没有子项的末级节点",
        read: field => field.leafOnly === true,
        write: (field, leafOnly) => {
          if (leafOnly === true) {
            return { ...field, leafOnly: true };
          }

          const next = { ...field };
          delete next.leafOnly;
          return next;
        }
      }),
      allowClearEntry<TreeSelectField>(),
      definePropertyEntry<TreeSelectField, boolean | undefined>({
        id: "showSearch",
        label: "可搜索",
        type: "checkbox",
        read: field => field.showSearch,
        write: (field, showSearch) => { return { ...field, showSearch: showSearch === true }; }
      })
    ]
  },
  {
    id: "storage",
    label: "存储",
    tab: "props",
    entries: [
      columnTypeEntry<TreeSelectField>([
        { value: "string", label: "字符串 (VARCHAR/TEXT)" },
        { value: "integer", label: "整数 (BIGINT)" }
      ])
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [requiredEntry<TreeSelectField>()]
  }
];

export const treeSelectFieldDefinition: FieldDefinition = defineFieldDefinition<TreeSelectField, string | number | undefined>({
  config: {
    type: "tree-select",
    name: "树形选择",
    group: "selection",
    keyed: true,
    icon: "list-tree",
    create: () => {
      return {
        type: "tree-select",
        label: "树形选择",
        dataSource: { kind: "static", options: [] }
      };
    }
  },
  Component: TreeSelectInput,
  properties: treeSelectProperties
});
