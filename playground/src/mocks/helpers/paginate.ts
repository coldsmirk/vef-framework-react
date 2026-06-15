import type { PaginationParams, PaginationResult } from "@vef-framework-react/core";

const DEFAULT_PAGE_SIZE = 15;

export function paginate<T>(items: T[], params: PaginationParams | undefined): PaginationResult<T> {
  const page = params?.page ?? 1;
  const size = params?.size ?? DEFAULT_PAGE_SIZE;
  const start = (page - 1) * size;

  return {
    total: items.length,
    items: items.slice(start, start + size)
  };
}

export function applyKeyword<T>(items: T[], keyword: string | undefined, fields: Array<keyof T>): T[] {
  if (!keyword) {
    return items;
  }

  const needle = keyword.toLowerCase();
  return items.filter(item => fields.some(field => {
    const value = item[field];
    return value !== null && value !== undefined && String(value).toLowerCase().includes(needle);
  }));
}
