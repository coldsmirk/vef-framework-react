import type { Block, FieldOption, FieldOptionSource, TreeMultiSelectField, TreeSelectField } from "../types";

import { omit } from "@vef-framework-react/shared";

import { isFixedSubform } from "./schema/subform";

interface OptionValueNode {
  value: unknown;
  children?: readonly OptionValueNode[];
}

export interface OptionWalkContext<T> {
  depth: number;
  hasChildren: boolean;
  ancestors: readonly T[];
}

/**
 * Depth-first pre-order walk over any hierarchical option tree, reporting each
 * node's nesting `depth`, whether it has non-empty `children`, and its active
 * `ancestors` stack (root-to-parent).
 */
export function walkOptionTree<T extends { readonly children?: readonly T[] }>(
  options: readonly T[],
  visit: (option: T, context: OptionWalkContext<T>) => void
): void {
  const ancestors: T[] = [];

  const walk = (nodes: readonly T[]): void => {
    for (const option of nodes) {
      const hasChildren = Array.isArray(option.children) && option.children.length > 0;

      visit(option, {
        depth: ancestors.length,
        hasChildren,
        ancestors
      });

      if (hasChildren) {
        ancestors.push(option);
        walk(option.children!);
        ancestors.pop();
      }
    }
  };

  walk(options);
}

/**
 * Type guard identifying hierarchical tree selection fields (`tree-select` or
 * `tree-multi-select`). Tree fields consume the full option hierarchy and carry
 * `leafOnly`; flat selection controls and fixed-row subforms consume top-level
 * options only.
 */
export function isTreeSelectField(field: { type: string }): field is TreeSelectField | TreeMultiSelectField {
  return field.type === "tree-select" || field.type === "tree-multi-select";
}

/**
 * Whether an option node has child options (i.e. is a non-leaf branch).
 */
export function hasOptionChildren(option: Pick<FieldOption, "children">): boolean {
  return Array.isArray(option.children) && option.children.length > 0;
}

/**
 * Return the stringified option values that appear more than once anywhere in
 * the option tree (depth-first pre-order, including nested children). Shared by
 * schema validation, approval projection, and `OptionListEditor`.
 */
export function findDuplicateOptionValues(options: readonly OptionValueNode[]): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  walkOptionTree(options, option => {
    const value = String(option.value);

    if (seen.has(value)) {
      duplicated.add(value);
    }

    seen.add(value);
  });

  return [...duplicated];
}

/**
 * Collect every stringified option value across an option tree.
 */
export function collectOptionValues(options: readonly OptionValueNode[]): Set<string> {
  const values = new Set<string>();

  walkOptionTree(options, option => {
    values.add(String(option.value));
  });

  return values;
}

/**
 * Count every option node across the full option tree (roots and descendants).
 */
export function countOptionNodes(options: readonly FieldOption[]): number {
  let count = 0;

  walkOptionTree(options, () => {
    count += 1;
  });

  return count;
}

/**
 * Project an option tree down to its top-level items with `children` omitted,
 * preserving `label`, `value`, `disabled`, and `description`. Used by flat
 * selection controls (`select`, `multi-select`, `radio`, `checkbox-group`) and
 * fixed-row subforms so nested children never leak into flat option lists.
 */
export function toTopLevelOptions(options: readonly FieldOption[]): FieldOption[] {
  return options.map(option => omit(option, ["children"]));
}

/**
 * Flatten an option tree in depth-first pre-order, optionally keeping only leaf
 * nodes (`leafOnly: true`) and stripping `children`.
 */
export function flattenSelectableOptions(
  options: readonly FieldOption[],
  config: { leafOnly?: boolean } = {}
): FieldOption[] {
  const { leafOnly = false } = config;
  const result: FieldOption[] = [];

  walkOptionTree(options, (option, { hasChildren }) => {
    if (!leafOnly || !hasChildren) {
      result.push(omit(option, ["children"]));
    }
  });

  return result;
}

/**
 * Derive the flat list of options selectable by `field`: tree controls flatten
 * the hierarchy in pre-order (honoring `leafOnly`), while flat selection
 * controls and fixed-row subforms take top-level items only. Shared by runtime
 * value normalization, permission projection, and approval projection.
 */
export function selectableOptionsForField(
  field: { type: string; leafOnly?: boolean } | undefined,
  options: readonly FieldOption[]
): FieldOption[] {
  if (field !== undefined && isTreeSelectField(field)) {
    return flattenSelectableOptions(options, { leafOnly: field.leafOnly === true });
  }

  return toTopLevelOptions(options);
}

/**
 * Index every option in a tree by its exact `value`, keeping the first sighting
 * on duplicate values. Enables O(1) label lookup for selected values (including
 * nested or disabled options).
 */
export function indexOptionsByValue(options: readonly FieldOption[]): Map<string | number, FieldOption> {
  const map = new Map<string | number, FieldOption>();

  walkOptionTree(options, option => {
    if (!map.has(option.value)) {
      map.set(option.value, option);
    }
  });

  return map;
}

/**
 * Collect the ancestor values along the path to every node whose value is in
 * `targetValues` (excluding the target nodes themselves). Used to expand tree
 * dropdowns and mobile popups to currently selected options by default.
 */
export function collectOptionAncestorValues(
  options: readonly FieldOption[],
  targetValues: ReadonlySet<string | number>
): Array<string | number> {
  if (targetValues.size === 0) {
    return [];
  }

  const ancestors = new Set<string | number>();

  walkOptionTree(options, (option, { ancestors: path }) => {
    if (targetValues.has(option.value)) {
      for (const ancestor of path) {
        ancestors.add(ancestor.value);
      }
    }
  });

  return [...ancestors];
}

/**
 * Case-insensitive substring match against an option's visible `label` or
 * `description` (never its storage `value`).
 */
export function matchesOptionQuery(
  query: string,
  option: { label?: unknown; description?: unknown } | undefined
): boolean {
  const normalized = query.trim().toLowerCase();

  if (normalized.length === 0) {
    return true;
  }

  if (option === undefined) {
    return false;
  }

  if (typeof option.label === "string" && option.label.toLowerCase().includes(normalized)) {
    return true;
  }

  return typeof option.description === "string" && option.description.toLowerCase().includes(normalized);
}

/**
 * Filter an option tree by a search query (matching `label` or `description`):
 * - any matching node retains its entire subtree so descendants beneath a
 * matched category stay reachable;
 * - any non-matching ancestor of a matching descendant retains only matching
 * branches;
 * - `expandedKeys` lists every ancestor of a matching descendant so deep hits
 * surface immediately while matched leaves/parents stay expandable on demand.
 */
export function filterOptionTree(
  options: readonly FieldOption[],
  query: string
): { options: FieldOption[]; expandedKeys: Array<string | number> } {
  const normalized = query.trim().toLowerCase();

  if (normalized.length === 0) {
    return { options: [...options], expandedKeys: [] };
  }

  const expanded = new Set<string | number>();

  const filterNodes = (nodes: readonly FieldOption[]): { filtered: FieldOption[]; hasMatch: boolean } => {
    const filtered: FieldOption[] = [];
    let anyMatch = false;

    for (const option of nodes) {
      const selfMatches = matchesOptionQuery(normalized, option);
      const childResult = hasOptionChildren(option)
        ? filterNodes(option.children!)
        : { filtered: [], hasMatch: false };

      if (childResult.hasMatch) {
        expanded.add(option.value);
      }

      if (selfMatches) {
        filtered.push(option);
        anyMatch = true;
      } else if (childResult.hasMatch) {
        filtered.push({ ...option, children: childResult.filtered });
        anyMatch = true;
      }
    }

    return { filtered, hasMatch: anyMatch };
  };

  return {
    options: filterNodes(options).filtered,
    expandedKeys: [...expanded]
  };
}

/**
 * Read the option source bound to a block, if any: a fixed-row subform exposes
 * `rows.source`, while a selection leaf exposes `dataSource`.
 */
export function getNodeOptionSource(node: Block): FieldOptionSource | undefined {
  if (node.type === "subform") {
    return isFixedSubform(node) ? node.rows.source : undefined;
  }

  return "dataSource" in node ? node.dataSource : undefined;
}
