/**
 * The reserved tenant of shared flows and categories, mirroring the Go
 * `approval.SharedTenantID`. A shared flow belongs to no tenant and is offered
 * to every tenant beside its own flows — a tenant flow with the same code
 * takes its place within that tenant — and each instance of it runs in, and
 * belongs to, the tenant that started it.
 *
 * Only super-admins create and change shared definitions: pass it as the
 * `tenantId` of `ApprovalFlowPage` / `ApprovalCategoryPage` to manage them. A
 * shared flow sits under a shared category and routes no task or CC to
 * specific people, which the flow designer enforces once the flow's tenant is
 * this one.
 */
export const SHARED_TENANT_ID = "0";
