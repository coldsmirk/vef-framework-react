import type { ReactElement, ReactNode } from "react";

import type { FieldOption } from "../../types";

import { TreeSelect } from "@vef-framework-react/components";
import { useMemo } from "react";

import { hasOptionChildren, indexOptionsByValue } from "../../engine/options";
import { OptionItemContent, useOptionTreeExpansion } from "./option-content";

const fullWidthStyle = { width: "100%" } as const;
const TREE_LINE = { showLeafIcon: false } as const;
const EMPTY_VALUES: Array<string | number> = [];

interface AntdTreeOptionNode {
  key: string | number;
  value: string | number;
  label: string;
  title: ReactNode;
  disabled?: boolean;
  selectable?: boolean;
  checkable?: boolean;
  children?: AntdTreeOptionNode[];
}

interface LabeledTreeValue {
  value: string | number;
  label?: ReactNode;
}

function toAntdTreeData(
  options: readonly FieldOption[],
  config: { leafOnly: boolean; checkable: boolean }
): AntdTreeOptionNode[] {
  const { checkable, leafOnly } = config;

  return options.map(option => {
    const hasChildren = hasOptionChildren(option);
    const blockedByLeafOnly = leafOnly && hasChildren;
    const node: AntdTreeOptionNode = {
      key: option.value,
      value: option.value,
      label: option.label,
      title: option.description !== undefined && option.description.length > 0
        ? <OptionItemContent description={option.description} label={option.label} />
        : option.label
    };

    if (option.disabled === true) {
      node.disabled = true;
    }

    if (blockedByLeafOnly) {
      node.selectable = false;

      if (checkable) {
        node.checkable = false;
      }
    }

    if (hasChildren) {
      node.children = toAntdTreeData(option.children!, config);
    }

    return node;
  });
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

interface OptionTreeSelectBaseProps {
  options: readonly FieldOption[];
  leafOnly?: boolean;
  showSearch?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  "aria-labelledby"?: string;
  placeholder?: string;
  notFoundContent?: ReactNode;
  popupMatchSelectWidth?: boolean | number;
  size?: "small" | "middle" | "large";
  status?: "error" | "warning";
}

export type OptionTreeSelectProps
  = | (OptionTreeSelectBaseProps & {
    multiple?: false;
    value?: string | number;
    onChange?: (value: string | number | undefined) => void;
  })
  | (OptionTreeSelectBaseProps & {
    multiple: true;
    value?: ReadonlyArray<string | number>;
    onChange?: (value: Array<string | number>) => void;
  });

/**
 * Shared desktop `TreeSelect` adapter used by `TreeSelectInput`,
 * `TreeMultiSelectInput`, `TypedLiteralInput`, and canvas `SampleCell`:
 * - filters through `filterOptionTree` (`showSearch.filterTreeNode: false`) so
 * PC and mobile produce identical search results;
 * - uses {@link useOptionTreeExpansion} for browse/search expansion;
 * - honors `leafOnly` with `treeExpandAction="click"` so clicking a branch
 * expands it instead of doing nothing;
 * - wires strict non-cascading `treeCheckStrictly` labeled values in multi mode
 * while looking up labels against the full unfiltered option tree so tags stay
 * readable during search.
 */
export function OptionTreeSelect(props: OptionTreeSelectProps): ReactElement {
  const {
    allowClear,
    "aria-labelledby": ariaLabelledBy,
    disabled,
    id,
    leafOnly = false,
    loading,
    multiple = false,
    notFoundContent,
    options,
    placeholder,
    popupMatchSelectWidth,
    showSearch = false,
    size,
    status
  } = props;

  const singleValue = !props.multiple && props.value !== "" && props.value !== undefined
    ? props.value
    : undefined;
  const multiValues = props.multiple && Array.isArray(props.value)
    ? props.value
    : EMPTY_VALUES;

  const selectedValues = useMemo<ReadonlyArray<string | number>>(
    () => props.multiple ? multiValues : singleValue === undefined ? EMPTY_VALUES : [singleValue],
    [multiValues, props.multiple, singleValue]
  );

  const {
    expandedKeys,
    onOpenChange,
    searchValue,
    setExpandedKeys,
    setSearchValue,
    visibleOptions
  } = useOptionTreeExpansion(options, selectedValues);

  const treeData = useMemo(
    () => toAntdTreeData(visibleOptions, { leafOnly, checkable: multiple }),
    [leafOnly, multiple, visibleOptions]
  );

  const optionByValue = useMemo(
    () => multiple ? indexOptionsByValue(options) : null,
    [multiple, options]
  );

  const labeledValue = useMemo<LabeledTreeValue[] | undefined>(() => {
    if (!multiple || optionByValue === null) {
      return;
    }

    return multiValues.map(item => {
      return {
        value: item,
        label: optionByValue.get(item)?.label ?? String(item)
      };
    });
  }, [multiValues, multiple, optionByValue]);

  const showSearchConfig = useMemo(
    () => showSearch
      ? {
          filterTreeNode: false as const,
          searchValue,
          onSearch: setSearchValue
        }
      : false,
    [searchValue, setSearchValue, showSearch]
  );

  return (
    <TreeSelect
      allowClear={allowClear}
      aria-labelledby={ariaLabelledBy}
      disabled={disabled}
      id={id}
      loading={loading}
      notFoundContent={notFoundContent}
      placeholder={placeholder}
      popupMatchSelectWidth={popupMatchSelectWidth}
      showSearch={showSearchConfig}
      size={size}
      status={status}
      style={fullWidthStyle}
      treeCheckable={multiple}
      treeCheckStrictly={multiple}
      treeData={treeData}
      treeExpandAction={leafOnly ? "click" : false}
      treeExpandedKeys={expandedKeys}
      treeLine={TREE_LINE}
      treeNodeLabelProp="label"
      value={multiple ? labeledValue : singleValue}
      onChange={next => {
        if (props.multiple) {
          props.onChange?.(unwrapTreeValues(next as Array<string | number | LabeledTreeValue> | undefined));
        } else {
          props.onChange?.(next as string | number | undefined);
        }
      }}
      onOpenChange={onOpenChange}
      onTreeExpand={setExpandedKeys}
    />
  );
}
