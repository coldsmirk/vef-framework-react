import type { FullAudited } from "./base";

/**
 * A flow category node, mirroring the Go `approval.FlowCategory`. Categories
 * form a tree via `parentId`; the find-tree query returns nested `children`.
 */
export interface FlowCategory extends FullAudited {
  tenantId: string;
  code: string;
  name: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  remark?: string | null;
  children?: FlowCategory[];
}

/**
 * Create/update parameters for a flow category.
 */
export interface CategoryParams {
  id?: string;
  tenantId: string;
  code: string;
  name: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  remark?: string | null;
}

/**
 * Search parameters for the category tree, sent as the request's `meta`.
 */
export interface CategorySearch {
  name?: string;
  isActive?: boolean;
  /**
   * Narrows a super-admin's read to one tenant — `SHARED_TENANT_ID` for the
   * shared categories. Everyone else always reads their own tenant.
   */
  tenantId?: string;
  /**
   * Adds the shared categories to the tenant's own — what a picker scoping a
   * delegation needs, since shared flows sit under shared categories.
   */
  includeShared?: boolean;
}
