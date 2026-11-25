import type { ReactElement, ReactNode } from "react";

import type { FieldOption } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { useCallback, useMemo, useState } from "react";

import {
  collectOptionAncestorValues,
  filterOptionTree,
  hasOptionChildren,
  matchesOptionQuery
} from "../../engine/options";

const stackCss = css({
  display: "inline-flex",
  flexDirection: "column",
  verticalAlign: "top",
  minWidth: 0,
  maxWidth: "100%",
  lineHeight: 1.4,
  paddingBlock: 3
});

const labelCss = css({
  color: "inherit",
  overflow: "hidden",
  textOverflow: "ellipsis"
});

const descriptionCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.35,
  whiteSpace: "normal",
  wordBreak: "break-word"
});

const inlineCss = css({
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
  minWidth: 0,
  maxWidth: "100%"
});

const inlineDescriptionCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

/**
 * Render an option's label with an optional muted secondary description line
 * (or inline suffix for fixed-height surfaces like mobile wheel pickers).
 */
export function OptionItemContent({
  description,
  inline = false,
  label
}: {
  label: string;
  description?: string;
  inline?: boolean;
}): ReactElement {
  if (description === undefined || description.length === 0) {
    return <>{label}</>;
  }

  if (inline) {
    return (
      <span css={inlineCss}>
        <span>{label}</span>
        <span css={inlineDescriptionCss}>{description}</span>
      </span>
    );
  }

  return (
    <span css={stackCss}>
      <span css={labelCss}>{label}</span>
      <span css={descriptionCss}>{description}</span>
    </span>
  );
}

/**
 * antd `Select.optionRender` callback showing optional `description` as
 * secondary muted text underneath the option label.
 */
export function renderSelectOption(option: {
  label?: ReactNode;
  data?: { label?: unknown; description?: unknown };
}): ReactNode {
  const description = typeof option.data?.description === "string" ? option.data.description : undefined;

  if (description === undefined || description.length === 0) {
    return option.label;
  }

  const label = typeof option.data?.label === "string" ? option.data.label : String(option.label ?? "");

  return <OptionItemContent description={description} label={label} />;
}

/**
 * Search filter shared by `Select`, `MultiSelect`, `TreeSelect`, and
 * `TreeMultiSelect`: matches the typed query case-insensitively against the
 * option's visible `label` or `description` (never its storage `value`).
 */
export function filterOptionByLabelOrDescription(
  input: string,
  option?: object
): boolean {
  return matchesOptionQuery(input, option as { label?: unknown; description?: unknown } | undefined);
}

export interface AntdTreeOptionNode {
  key: string | number;
  value: string | number;
  label: string;
  title: ReactNode;
  description?: string;
  disabled?: boolean;
  selectable?: boolean;
  checkable?: boolean;
  children?: AntdTreeOptionNode[];
}

/**
 * Convert {@link FieldOption} hierarchy into antd `TreeSelect` `treeData`:
 * - keeps `label` as plain text (read by `treeNodeLabelProp="label"` so the
 * selected trigger / tags never leak description markup);
 * - renders `description` inside `title` as secondary muted text;
 * - honors `disabled` (unselectable / uncheckable while children stay reachable)
 * and `leafOnly` (non-leaf nodes cannot be selected or checked).
 */
export function toAntdTreeData(
  options: readonly FieldOption[],
  config: { leafOnly: boolean; checkable: boolean }
): AntdTreeOptionNode[] {
  const { checkable, leafOnly } = config;

  return options.map(option => {
    const hasChildren = hasOptionChildren(option);
    const blockedByLeafOnly = leafOnly && hasChildren;
    const isDisabled = option.disabled === true;
    const node: AntdTreeOptionNode = {
      key: option.value,
      value: option.value,
      label: option.label,
      title: option.description !== undefined && option.description.length > 0
        ? <OptionItemContent description={option.description} label={option.label} />
        : option.label
    };

    if (option.description !== undefined && option.description.length > 0) {
      node.description = option.description;
    }

    if (isDisabled) {
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

/**
 * Manage `treeExpandedKeys` for PC `TreeSelect` / `TreeMultiSelect`:
 * - automatically expands ancestors of the currently selected value(s) on open
 * (including when options arrive asynchronously);
 * - while searching, expands every ancestor of matching descendants so deep
 * hits surface immediately;
 * - preserves manual expand/collapse actions while the dropdown is open.
 */
export function useTreeSelectExpansion(
  options: readonly FieldOption[],
  selectedValues: ReadonlyArray<string | number>
): {
  expandedKeys: Array<string | number>;
  searchValue: string;
  onOpenChange: (open: boolean) => void;
  onSearch: (next: string) => void;
  onTreeExpand: (keys: ReadonlyArray<string | number | bigint>) => void;
} {
  const [manualKeys, setManualKeys] = useState<Array<string | number> | null>(null);
  const [searchValue, setSearchValue] = useState("");

  const selectedAncestors = useMemo(
    () => collectOptionAncestorValues(options, new Set(selectedValues)),
    [options, selectedValues]
  );

  const searchExpandedKeys = useMemo(
    () => searchValue.trim().length > 0 ? filterOptionTree(options, searchValue).expandedKeys : [],
    [options, searchValue]
  );

  const onOpenChange = useCallback((open: boolean) => {
    if (open) {
      setManualKeys(prev => {
        if (prev === null) {
          return selectedAncestors;
        }

        if (selectedAncestors.length === 0) {
          return prev;
        }

        const merged = new Set<string | number>(prev);

        for (const key of selectedAncestors) {
          merged.add(key);
        }

        return merged.size === prev.length ? prev : [...merged];
      });
    } else {
      setSearchValue("");
    }
  }, [selectedAncestors]);

  const onTreeExpand = useCallback((keys: ReadonlyArray<string | number | bigint>) => {
    setManualKeys(keys.filter((key): key is string | number => typeof key === "string" || typeof key === "number"));
  }, []);

  const expandedKeys = useMemo(() => {
    if (searchValue.trim().length > 0) {
      return searchExpandedKeys;
    }

    return manualKeys ?? selectedAncestors;
  }, [manualKeys, searchExpandedKeys, searchValue, selectedAncestors]);

  return {
    expandedKeys,
    searchValue,
    onOpenChange,
    onSearch: setSearchValue,
    onTreeExpand
  };
}
