import type { DataOption } from "@vef-framework-react/core";
import type { MaybeNull } from "@vef-framework-react/shared";

import { faker } from "@faker-js/faker";

import { defineMock, MockBusinessError } from "../define-mock";
import { makeAudit, stampUpdate } from "./audit";

interface TreeRow {
  id: string;
  parentId?: MaybeNull<string>;
  children?: TreeRow[];
}

export interface TreeOptions<T extends TreeRow> {
  resource: string;
  factory: (index: number) => T;
  seed?: number;
  labelField?: keyof T;
  /**
   * Optional resource-level filter (e.g. by appId).
   */
  where?: (items: T[], params: Record<string, unknown>) => T[];
  /**
   * Field that drives the keyword filter (matches name by default).
   */
  searchField?: keyof T;
  /**
   * Hook to enrich each row before nesting (e.g. resolve FK display names).
   */
  decorate?: (row: T) => T;
}

export interface TreeHandle<T extends TreeRow> {
  store: T[];
}

function nest<T extends TreeRow>(rows: T[]): T[] {
  const byId = new Map<string, T>();

  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }

  const roots: T[] = [];

  for (const row of byId.values()) {
    const parent = row.parentId ? byId.get(row.parentId) : undefined;

    if (parent) {
      parent.children!.push(row);
    } else {
      roots.push(row);
    }
  }

  // Drop empty children arrays so the UI doesn't render expand carets.
  for (const row of byId.values()) {
    if (row.children && row.children.length === 0) {
      delete row.children;
    }
  }

  return roots;
}

function flatten<T extends TreeRow>(rows: T[]): T[] {
  const out: T[] = [];

  const walk = (row: T): void => {
    out.push(row);

    if (row.children) {
      for (const child of row.children) {
        walk(child as T);
      }
    }
  };

  for (const row of rows) {
    walk(row);
  }

  return out;
}

function toOptions<T extends TreeRow>(rows: T[], labelField: keyof T | undefined): DataOption[] {
  return rows.map(row => {
    const label = String(row[labelField ?? "name" as keyof T] ?? row.id);
    const node: DataOption = { label, value: row.id };

    if (row.children && row.children.length > 0) {
      node.children = toOptions(row.children as T[], labelField);
    }

    return node;
  });
}

export function createTreeMock<T extends TreeRow>(options: TreeOptions<T>): TreeHandle<T> {
  const flat: T[] = Array.from({ length: options.seed ?? 12 }, (_, i) => ({
    ...makeAudit(),
    ...options.factory(i)
  } as unknown as T));

  function decorate(row: T): T {
    return options.decorate ? options.decorate(row) : row;
  }

  function applyFilters(params: Record<string, unknown>): T[] {
    let rows = [...flat];

    if (options.where) {
      rows = options.where(rows, params);
    }

    if (options.searchField) {
      const keyword = typeof params.keyword === "string" ? params.keyword : undefined;

      if (keyword) {
        const needle = keyword.toLowerCase();
        const matched = new Set<string>();
        const { searchField } = options;

        for (const row of rows) {
          const haystack = String(row[searchField] ?? "").toLowerCase();

          if (haystack.includes(needle)) {
            matched.add(row.id);
            addAncestors(row, rows, matched);
          }
        }

        rows = rows.filter(row => matched.has(row.id));
      }
    }

    return rows.map(row => decorate(row));
  }

  defineMock<Record<string, unknown>, T[]>(options.resource, "find_tree", ({ params }) => nest(applyFilters(params ?? {})));

  defineMock<Record<string, unknown>, DataOption[]>(options.resource, "find_tree_options", ({ params }) => toOptions(nest(applyFilters(params ?? {})), options.labelField));

  defineMock<T, T>(options.resource, "create", ({ params }) => {
    const id = params.id ?? faker.string.uuid();
    const row = {
      ...makeAudit(),
      ...params,
      id
    } as T;
    flat.unshift(row);
    return row;
  });

  defineMock<T, T>(options.resource, "update", ({ params }) => {
    const idx = flat.findIndex(row => row.id === params.id);

    if (idx === -1) {
      throw new MockBusinessError(404, `${options.resource} 不存在: ${params.id}`);
    }

    const updated: T = {
      ...flat[idx],
      ...params,
      ...stampUpdate()
    };
    flat[idx] = updated;
    return updated;
  });

  defineMock<{ id: string }, null>(options.resource, "delete", ({ params }) => {
    // Detach children up to the parent so the subtree survives a single
    // delete (cascading delete is rarely the demo's intent).
    const target = flat.find(row => row.id === params.id);

    if (!target) {
      return null;
    }

    for (const row of flat) {
      if (row.parentId === params.id) {
        row.parentId = target.parentId ?? null;
      }
    }

    const idx = flat.findIndex(row => row.id === params.id);

    if (idx !== -1) {
      flat.splice(idx, 1);
    }

    return null;
  });

  return { store: flat };
}

function addAncestors<T extends TreeRow>(row: T, rows: T[], matched: Set<string>): void {
  // Also include ancestors so the tree stays connected.
  let current: T | undefined = row;

  while (current?.parentId) {
    const next: string = current.parentId;
    matched.add(next);
    current = rows.find(candidate => candidate.id === next);
  }
}

export { flatten as flattenTree, nest as nestTree };
