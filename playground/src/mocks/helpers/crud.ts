import type { DataOption, PaginationParams, PaginationResult } from "@vef-framework-react/core";
import type { FullTracked } from "@vef-framework-react/starter";

import { faker } from "@faker-js/faker";

import { defineMock, MockBusinessError } from "../define-mock";
import { makeAudit, stampUpdate } from "./audit";

interface CrudRow {
  id: string;
}

export interface CrudOptions<T extends CrudRow> {
  resource: string;
  /**
   * Builder for a seeded row. Called `seed` times at startup. The factory
   * returns the row's domain fields; the helper stamps `FullTracked` audit
   * fields on top.
   */
  factory: (index: number) => Omit<T, keyof FullTracked>;
  /**
   * Number of rows seeded at startup.
   *
   * @default 20
   */
  seed?: number;
  /**
   * Fields the keyword search scans. When omitted, the keyword param is
   * ignored (handler returns the full list).
   */
  searchFields?: Array<keyof T>;
  /**
   * Field used as `DataOption.label`. Defaults to `"name"` for the common
   * case.
   */
  labelField?: keyof T;
  /**
   * Project-specific filter applied before keyword filtering — useful for
   * dropdowns scoped by parent id (e.g. `dictionaryId`, `appId`).
   */
  where?: (items: T[], params: Record<string, unknown>) => T[];
  /**
   * Hook to mutate the params passed to `create` before they are spread
   * onto the new row — e.g. resolve fk display names.
   */
  onCreate?: (row: T) => T;
  /**
   * Hook to enrich rows returned by `find_options` / `find_page`.
   */
  decorate?: (row: T) => T;
  /**
   * Registers `delete_many` when true. Most resources do, but some
   * (tree-shaped, audit-log) don't expose it.
   *
   * @default true
   */
  withDeleteMany?: boolean;
}

export interface CrudHandle<T extends CrudRow> {
  store: T[];
  add: (row: T) => void;
  find: (id: string) => T | undefined;
}

function defaultLabel<T extends CrudRow>(row: T, labelField: keyof T | undefined): string {
  if (!labelField) {
    return String((row as Record<string, unknown>).name ?? row.id);
  }

  return String(row[labelField] ?? row.id);
}

export function createCrudMock<T extends CrudRow>(options: CrudOptions<T>): CrudHandle<T> {
  const store: T[] = Array.from({ length: options.seed ?? 20 }, (_, i) => ({
    ...makeAudit(),
    ...options.factory(i)
  } as unknown as T));

  function decorate(row: T): T {
    return options.decorate ? options.decorate(row) : row;
  }

  function selectFiltered(params: Record<string, unknown>): T[] {
    let rows = [...store];

    if (options.where) {
      rows = options.where(rows, params);
    }

    if (options.searchFields) {
      const keyword = typeof params.keyword === "string" ? params.keyword : undefined;
      rows = applyKeywordLocal(rows, keyword, options.searchFields);
    }

    return rows.map(row => decorate(row));
  }

  defineMock<Record<string, unknown>, DataOption[]>(
    options.resource,
    "find_options",
    ({ params }) => selectFiltered(params ?? {}).map(row => {
      return {
        label: defaultLabel(row, options.labelField),
        value: row.id
      };
    })
  );

  defineMock<Record<string, unknown>, PaginationResult<T>>(
    options.resource,
    "find_page",
    ({ params, meta }) => {
      const rows = selectFiltered(params ?? {});
      return paginateLocal(rows, meta as PaginationParams | undefined);
    }
  );

  defineMock<T, T>(options.resource, "create", ({ params }) => {
    const id = (params as Partial<CrudRow>).id ?? faker.string.uuid();
    const row = {
      ...makeAudit(),
      ...params,
      id
    } as T;
    const finalized = options.onCreate ? options.onCreate(row) : row;
    store.unshift(finalized);
    return finalized;
  });

  defineMock<T, T>(options.resource, "update", ({ params }) => {
    const idx = store.findIndex(row => row.id === params.id);

    if (idx === -1) {
      throw new MockBusinessError(404, `${options.resource} 不存在: ${params.id}`);
    }

    const updated: T = {
      ...store[idx],
      ...params,
      ...stampUpdate()
    };
    store[idx] = updated;
    return updated;
  });

  defineMock<{ id: string }, null>(options.resource, "delete", ({ params }) => {
    const idx = store.findIndex(row => row.id === params.id);

    if (idx !== -1) {
      store.splice(idx, 1);
    }

    return null;
  });

  if (options.withDeleteMany ?? true) {
    defineMock<{ pks: string[] }, null>(options.resource, "delete_many", ({ params }) => {
      const pks = new Set(params.pks);

      for (let i = store.length - 1; i >= 0; i--) {
        const row = store[i];

        if (row && pks.has(row.id)) {
          store.splice(i, 1);
        }
      }

      return null;
    });
  }

  return {
    store,
    add(row: T): void {
      store.unshift(row);
    },
    find(id: string): T | undefined {
      return store.find(row => row.id === id);
    }
  };
}

// Local re-imports kept inside the file so `crud.ts` is self-contained for
// readers; both helpers are also exported from `./paginate` for direct use
// by hand-written modules.
function paginateLocal<T>(items: T[], params: PaginationParams | undefined): PaginationResult<T> {
  const page = params?.page ?? 1;
  const size = params?.size ?? 15;
  const start = (page - 1) * size;
  return { total: items.length, items: items.slice(start, start + size) };
}

function applyKeywordLocal<T>(items: T[], keyword: string | undefined, fields: Array<keyof T>): T[] {
  if (!keyword) {
    return items;
  }

  const needle = keyword.toLowerCase();
  return items.filter(item => fields.some(field => {
    const value = item[field];
    return value !== null && value !== undefined && String(value).toLowerCase().includes(needle);
  }));
}
