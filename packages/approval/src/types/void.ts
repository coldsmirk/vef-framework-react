import type { FullAudited, UserInfo } from "./base";

export const VOID_REQUEST_KIND = "approval.void_request";
export type VoidPolicy = "disabled" | "direct" | "approval";
export type VoidOptions = Record<string, unknown>;

export interface VoidPlan {
  blockers: string[];
  reversals: string[];
  followUps: string[];
}

export interface VoidRecord extends FullAudited {
  tenantId: string;
  instanceId?: string;
  status: "requested" | "voided" | "dismissed";
  requestInstanceId?: string;
  operator: UserInfo;
  reason?: string;
  attachments?: string[];
  options?: VoidOptions;
  reversals: string[];
  followUps: string[];
  voidedAt?: string;
}

export interface VoidRequestSummary {
  requestInstanceId: string;
  requestInstanceNo: string;
  requestStatus: "running" | "returned";
  applicant: UserInfo;
  createdAt: string;
}

export interface VoidTarget {
  instanceId?: string;
  instanceNo?: string;
  title?: string;
  flowName?: string;
  applicant?: UserInfo;
  finishedAt?: string;
  businessKind?: string;
}

export interface VoidRequestBusinessView {
  target: VoidTarget;
  plan: VoidPlan;
  record: VoidRecord;
}

export interface PlanVoidParams {
  instanceId: string;
  options?: VoidOptions;
}

export interface PlanVoidResult {
  policy: VoidPolicy;
  plan: VoidPlan;
}

export interface RequesterVoidPlanResult extends PlanVoidResult {
  voidFlowCode: string;
}

export interface VoidInstanceParams extends PlanVoidParams {
  reason: string;
  attachments?: string[];
}
