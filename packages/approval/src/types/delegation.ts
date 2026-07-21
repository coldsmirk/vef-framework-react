import type { FullAudited } from "./base";

/**
 * An approval delegation, mirroring the Go `approval.Delegation`: during the
 * active window, tasks assigned to the delegator are routed to the delegatee.
 * Scope narrows via `flowCategoryId` / `flowId`; both empty means all flows.
 */
export interface Delegation extends FullAudited {
  delegatorId: string;
  delegateeId: string;
  flowCategoryId?: string | null;
  flowId?: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  reason?: string | null;
}

/**
 * Create/update parameters for a delegation.
 */
export interface DelegationParams {
  id?: string;
  delegatorId: string;
  delegateeId: string;
  flowCategoryId?: string | null;
  flowId?: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  reason?: string | null;
}

/**
 * Search parameters for the delegation list.
 */
export interface DelegationSearch {
  delegatorId?: string;
  delegateeId?: string;
  isActive?: boolean;
}
