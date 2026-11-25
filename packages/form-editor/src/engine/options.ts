import type { Block, FieldOption, FieldOptionSource } from "../types";

import { isFixedSubform } from "./schema/subform";

interface OptionValueNode {
  value: unknown;
  children?: readonly OptionValueNode[];
}

/**
 * Whether a widget type is a hierarchical tree selection control (`tree-select`
 * or `tree-multi-select`). Tree controls consume the full option hierarchy;
 * flat selection controls (`select`, `multi-select`, `radio`, `checkbox-group`)
 * and fixed-row subforms consume top-level options only.
 */
export function isTreeSelectFieldType(type: string): type is "tree-select" | "tree-multi-select" {
  return type === "tree-select" || type === "tree-multi-select";
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

  const walk = (nodes: readonly OptionValueNode[]): void => {
    for (const option of nodes) {
      const value = String(option.value);

      if (seen.has(value)) {
        duplicated.add(value);
      }

      seen.add(value);

      if (Array.isArray(option.children) && option.children.length > 0) {
        walk(option.children);
      }
    }
  };

  walk(options);

  return [...duplicated];
}

/**
 * Collect every stringified option value across an option tree.
 */
export function collectOptionValues(options: readonly OptionValueNode[]): Set<string> {
  const values = new Set<string>();

  const walk = (nodes: readonly OptionValueNode[]): void => {
    for (const option of nodes) {
      values.add(String(option.value));

      if (Array.isArray(option.children) && option.children.length > 0) {
        walk(option.children);
      }
    }
  };

  walk(options);

  return values;
}

/**
 * Count every option node across the full option tree (roots and descendants).
 */
export function countOptionNodes(options: readonly FieldOption[]): number {
  let count = 0;

  const walk = (nodes: readonly FieldOption[]): void => {
    for (const option of nodes) {
      count += 1;

      if (hasOptionChildren(option)) {
        walk(option.children!);
      }
    }
  };

  walk(options);

  return count;
}

/**
 * Project an option tree down to its top-level items with `children` omitted,
 * preserving `label`, `value`, `disabled`, and `description`. Used by flat
 * selection controls (`select`, `multi-select`, `radio`, `checkbox-group`) and
 * fixed-row subforms so nested children never leak into flat option lists.
 */
export function toTopLevelOptions(options: readonly FieldOption[]): FieldOption[] {
  return options.map(option => {
    const flat: FieldOption = {
      label: option.label,
      value: option.value
    };

    if (option.disabled === true) {
      flat.disabled = true;
    }

    if (option.description !== undefined && option.description.length > 0) {
      flat.description = option.description;
    }

    return flat;
  });
}

/**
 * Flatten an option tree in depth-first pre-order, optionally keeping only leaf
 * nodes (`leafOnly: true`) and stripping `children`. Shared by value
 * normalization, approval/permission projection, and typed literal inputs.
 */
export function flattenSelectableOptions(
  options: readonly FieldOption[],
  config: { leafOnly?: boolean } = {}
): FieldOption[] {
  const { leafOnly = false } = config;
  const result: FieldOption[] = [];

  const walk = (nodes: readonly FieldOption[]): void => {
    for (const option of nodes) {
      const hasChildren = hasOptionChildren(option);

      if (!leafOnly || !hasChildren) {
        const flat: FieldOption = {
          label: option.label,
          value: option.value
        };

        if (option.disabled === true) {
          flat.disabled = true;
        }

        if (option.description !== undefined && option.description.length > 0) {
          flat.description = option.description;
        }

        result.push(flat);
      }

      if (hasChildren) {
        walk(option.children!);
      }
    }
  };

  walk(options);

  return result;
}

/**
 * Index every option in a tree by its exact `value`, keeping the first sighting
 * on duplicate values. Enables O(1) label lookup for selected values (including
 * nested or disabled options).
 */
export function indexOptionsByValue(options: readonly FieldOption[]): Map<string | number, FieldOption> {
  const map = new Map<string | number, FieldOption>();

  const walk = (nodes: readonly FieldOption[]): void => {
    for (const option of nodes) {
      if (!map.has(option.value)) {
        map.set(option.value, option);
      }

      if (hasOptionChildren(option)) {
        walk(option.children!);
      }
    }
  };

  walk(options);

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

  const walk = (nodes: readonly FieldOption[], path: Array<string | number>): void => {
    for (const option of nodes) {
      if (targetValues.has(option.value)) {
        for (const ancestor of path) {
          ancestors.add(ancestor);
        }
      }

      if (hasOptionChildren(option)) {
        path.push(option.value);
        walk(option.children!, path);
        path.pop();
      }
    }
  };

  walk(options, []);

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
 * Filter an option tree by a search query (matching `label` or `description`),
 * retaining every ancestor of a matching descendant and reporting the ancestor
 * values that must be expanded to reveal all matches.
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

  const filterNodes = (nodes: readonly FieldOption[]): FieldOption[] => {
    const out: FieldOption[] = [];

    for (const option of nodes) {
      const selfMatches = matchesOptionQuery(normalized, option);
      const filteredChildren = hasOptionChildren(option) ? filterNodes(option.children!) : [];

      if (filteredChildren.length > 0) {
        expanded.add(option.value);
        out.push({ ...option, children: filteredChildren });
      } else if (selfMatches) {
        // When a branch matches directly, keep its subtree intact so the user
        // can still inspect or pick children beneath the matched category.
        out.push(option);
      }
    }

    return out;
  };

  return {
    options: filterNodes(options),
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
