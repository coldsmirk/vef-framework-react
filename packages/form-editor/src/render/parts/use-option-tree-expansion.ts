import type { FieldOption } from "../../types";

import { useCallback, useMemo, useState } from "react";

import { collectOptionAncestorValues, filterOptionTree, walkOptionTree } from "../../engine/options";

type OptionKey = string | number;

function buildOptionsTopologyKey(options: readonly FieldOption[]): string {
  const parts: string[] = [];

  walkOptionTree(options, (option, { depth }) => {
    parts.push(`${depth}:${String(option.value)}`);
  });

  return parts.join("\u{0}");
}

function toggleKey(keys: OptionKey[], key: OptionKey): OptionKey[] {
  return keys.includes(key) ? keys.filter(item => item !== key) : [...keys, key];
}

export interface OptionTreeExpansionState {
  visibleOptions: readonly FieldOption[];
  expandedKeys: OptionKey[];
  searchValue: string;
  isSearching: boolean;
  setSearchValue: (next: string) => void;
  setExpandedKeys: (keys: OptionKey[]) => void;
  toggleExpandedKey: (key: OptionKey) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Search filtering and tree expansion shared by the desktop (`OptionTreeSelect`)
 * and mobile (`MobileTreePicker`) tree controls:
 * - expansion is computed on open, when the options change structure (e.g. a
 * remote fetch resolving while the popup is open), and when the query changes —
 * the ancestors of the selected values while browsing, of the matching
 * descendants while searching;
 * - browsing and searching each keep their own expansion, so expanding or
 * collapsing a search result leaves the browsed tree as it was;
 * - a change of the selected values alone never resets it.
 */
export function useOptionTreeExpansion(
  options: readonly FieldOption[],
  selectedValues: readonly OptionKey[]
): OptionTreeExpansionState {
  const [searchValue, setSearchValueState] = useState("");
  const query = searchValue.trim();
  const isSearching = query.length > 0;

  const filtered = useMemo(() => isSearching ? filterOptionTree(options, query) : null, [isSearching, options, query]);

  const expandToSelected = (): OptionKey[] => collectOptionAncestorValues(options, new Set(selectedValues));

  const topologyKey = useMemo(() => buildOptionsTopologyKey(options), [options]);
  const [prevTopologyKey, setPrevTopologyKey] = useState(topologyKey);
  const [browseExpandedKeys, setBrowseExpandedKeys] = useState<OptionKey[]>(expandToSelected);
  const [searchExpandedKeys, setSearchExpandedKeys] = useState<OptionKey[]>([]);

  if (prevTopologyKey !== topologyKey) {
    setPrevTopologyKey(topologyKey);
    setBrowseExpandedKeys(expandToSelected());
    setSearchExpandedKeys(filtered?.expandedKeys ?? []);
  }

  const setActiveExpandedKeys = isSearching ? setSearchExpandedKeys : setBrowseExpandedKeys;

  const setSearchValue = useCallback((next: string): void => {
    const nextQuery = next.trim();

    setSearchValueState(next);

    if (nextQuery !== query) {
      setSearchExpandedKeys(filterOptionTree(options, nextQuery).expandedKeys);
    }
  }, [options, query]);

  const toggleExpandedKey = useCallback(
    (key: OptionKey): void => setActiveExpandedKeys(prev => toggleKey(prev, key)),
    [setActiveExpandedKeys]
  );

  const expandedKeys = isSearching ? searchExpandedKeys : browseExpandedKeys;

  // Typing into a closed desktop control searches and opens in one go, so the
  // query is dropped on close and never on open. Closing keeps the rows as they
  // are shown, for the popup is still fading out; opening expands afresh.
  const onOpenChange = (open: boolean): void => {
    if (open) {
      setBrowseExpandedKeys(expandToSelected());
    } else {
      setSearchValueState("");
      setSearchExpandedKeys([]);
      setBrowseExpandedKeys(expandedKeys);
    }
  };

  return {
    visibleOptions: filtered?.options ?? options,
    expandedKeys,
    searchValue,
    isSearching,
    setSearchValue,
    setExpandedKeys: setActiveExpandedKeys,
    toggleExpandedKey,
    onOpenChange
  };
}
