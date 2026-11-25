import type { FC, ReactNode } from "react";

import type {
  FieldComponentProps,
  FieldDefinition,
  FieldOptionSource,
  PropertiesDescriptor,
  TreeMultiSelectField
} from "../../types";

import { TreeSelect } from "@vef-framework-react/components";
import { useMemo } from "react";

import { indexOptionsByValue } from "../../engine/options";
import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell, useFieldCell } from "../../render/parts/field-shell";
import {
  filterOptionByLabelOrDescription,
  toAntdTreeData,
  useTreeSelectExpansion
} from "../../render/parts/option-content";
import { resolveFieldPlaceholder } from "../../render/parts/placeholder";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { allowClearEntry, requiredEntry, sizeEntry } from "../field-entries";

const treeSelectStyle = { width: "100%" } as const;
const TREE_LINE = { showLeafIcon: false } as const;
const EMPTY_VALUE: Array<string | number> = [];

interface LabeledTreeValue {
  value: string | number;
  label?: ReactNode;
}

function unwrapTreeValues(next: Array<string | number | LabeledTreeValue> | undefined): Array<string | number> {
  if (!Array.isArray(next)) {
    return [];
  }

  const out: Array<string | number> = [];

  for (const item of next) {
    if (typeof item === "string" || typeof item === "number") {
      out.push(item);
    } else if (typeof item === "object" && item !== null && "value" in item) {
      out.push(item.value);
    }
  }

  return out;
}

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
  const optionByValue = useMemo(() => indexOptionsByValue(options), [options]);
  // `treeCheckStrictly` requires labeled values so parent and child checks stay
  // strictly independent without cascading. Falling back to `String(item)` keeps
  // values absent from the current option tree visible and removable as tags.
  const labeledValue = useMemo<LabeledTreeValue[]>(
    () => current.map(item => {
      return {
        value: item,
        label: optionByValue.get(item)?.label ?? String(item)
      };
    }),
    [current, optionByValue]
  );
  const treeData = useMemo(
    () => toAntdTreeData(options, { leafOnly: field.leafOnly === true, checkable: true }),
    [field.leafOnly, options]
  );
  const {
    expandedKeys,
    onOpenChange,
    onSearch,
    onTreeExpand,
    searchValue
  } = useTreeSelectExpansion(options, current);

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "树形多选"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <TreeSelect
        treeCheckable
        treeCheckStrictly
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
        value={labeledValue}
        onChange={next => onChange(unwrapTreeValues(next as Array<string | number | LabeledTreeValue> | undefined))}
        onOpenChange={onOpenChange}
        onSearch={onSearch}
        onTreeExpand={onTreeExpand}
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
      definePropertyEntry<TreeMultiSelectField, boolean | undefined>({
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
