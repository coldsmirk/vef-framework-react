import type { ReactElement, ReactNode } from "react";

import type { FieldOption } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  collectOptionAncestorValues,
  filterOptionTree,
  matchesOptionQuery,
  walkOptionTree
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
 * Search filter shared by flat `Select` and `MultiSelect` controls: matches the
 * typed query case-insensitively against the option's visible `label` or
 * `description` (never its storage `value`).
 */
export function filterOptionByLabelOrDescription(
  input: string,
  option?: object
): boolean {
  return matchesOptionQuery(input, option as { label?: unknown; description?: unknown } | undefined);
}

function buildOptionsTopologyKey(options: readonly FieldOption[]): string {
  const parts: string[] = [];

  walkOptionTree(options, (option, { depth }) => {
    parts.push(`${depth}:${String(option.value)}`);
  });

  return parts.join("\u{0}");
}

export interface OptionTreeExpansionState {
  visibleOptions: readonly FieldOption[];
  expandedKeys: Array<string | number>;
  expandedKeySet: ReadonlySet<string | number>;
  searchValue: string;
  isSearching: boolean;
  setSearchValue: (next: string) => void;
  setExpandedKeys: (keys: ReadonlyArray<string | number | bigint>) => void;
  toggleExpandedKey: (key: string | number) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shared search-filtering and tree-expansion state for both PC (`OptionTreeSelect`)
 * and mobile (`MobileTreePicker`) tree selection controls:
 * - computes initial expansion on open, when options arrive asynchronously
 * (topology changes), and whenever the search query changes (empty query →
 * ancestors of currently selected values; non-empty query → ancestors of
 * matching descendants);
 * - keeps search-mode and browse-mode expansion separate so clicking expand or
 * collapse while searching works freely (e.g. expanding a matched parent to
 * pick its children) without overwriting non-search expansion;
 * - never resets expansion when the selected/checked values change.
 */
export function useOptionTreeExpansion(
  options: readonly FieldOption[],
  selectedValues: ReadonlyArray<string | number>
): OptionTreeExpansionState {
  const [searchValue, setSearchValueState] = useState("");
  const trimmedQuery = searchValue.trim();
  const isSearching = trimmedQuery.length > 0;

  const filtered = useMemo(
    () => isSearching ? filterOptionTree(options, trimmedQuery) : null,
    [isSearching, options, trimmedQuery]
  );
  const visibleOptions = filtered === null ? options : filtered.options;

  const topologyKey = useMemo(() => buildOptionsTopologyKey(options), [options]);
  const [prevTopologyKey, setPrevTopologyKey] = useState(topologyKey);
  const [browseExpandedKeys, setBrowseExpandedKeys] = useState<Array<string | number>>(
    () => collectOptionAncestorValues(options, new Set(selectedValues))
  );
  const [searchExpandedKeys, setSearchExpandedKeys] = useState<Array<string | number>>([]);

  // Recompute initial expansion synchronously when options arrive or change
  // structure (e.g. remote fetch resolves while the popup is open), without
  // reacting to selection changes on the same option tree.
  if (prevTopologyKey !== topologyKey) {
    setPrevTopologyKey(topologyKey);
    setBrowseExpandedKeys(collectOptionAncestorValues(options, new Set(selectedValues)));
    setSearchExpandedKeys(filtered === null ? [] : filtered.expandedKeys);
  }

  const trimmedQueryRef = useRef(trimmedQuery);
  trimmedQueryRef.current = trimmedQuery;

  const setSearchValue = useCallback((next: string) => {
    setSearchValueState(next);

    const nextTrimmed = next.trim();

    if (trimmedQueryRef.current !== nextTrimmed) {
      trimmedQueryRef.current = nextTrimmed;
      setSearchExpandedKeys(nextTrimmed.length > 0 ? filterOptionTree(options, nextTrimmed).expandedKeys : []);
    }
  }, [options]);

  const setExpandedKeys = useCallback((keys: ReadonlyArray<string | number | bigint>) => {
    const normalized = keys.filter(
      (key): key is string | number => typeof key === "string" || typeof key === "number"
    );

    if (isSearching) {
      setSearchExpandedKeys(normalized);
    } else {
      setBrowseExpandedKeys(normalized);
    }
  }, [isSearching]);

  const toggleExpandedKey = useCallback((key: string | number) => {
    const toggle = (prev: Array<string | number>): Array<string | number> => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key];

    if (isSearching) {
      setSearchExpandedKeys(toggle);
    } else {
      setBrowseExpandedKeys(toggle);
    }
  }, [isSearching]);

  const onOpenChange = useCallback((open: boolean) => {
    trimmedQueryRef.current = "";
    setSearchValueState("");
    setSearchExpandedKeys([]);

    if (open) {
      setBrowseExpandedKeys(collectOptionAncestorValues(options, new Set(selectedValues)));
    }
  }, [options, selectedValues]);

  const expandedKeys = isSearching ? searchExpandedKeys : browseExpandedKeys;
  const expandedKeySet = useMemo<ReadonlySet<string | number>>(() => new Set(expandedKeys), [expandedKeys]);

  return {
    visibleOptions,
    expandedKeys,
    expandedKeySet,
    searchValue,
    isSearching,
    setSearchValue,
    setExpandedKeys,
    toggleExpandedKey,
    onOpenChange
  };
}
