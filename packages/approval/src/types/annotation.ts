import type { UserInfo } from "./base";

export type AnnotationStatus = "draft" | "published" | "discarded";
export type AnnotationResolution = "addressed" | "declined";
export type AnnotationAudience
  = | { scope: "participants" | "applicant" }
    | { scope: "nodes"; nodeIds: string[] }
    | { scope: "users"; userIds: string[] };

export interface FieldAnchor {
  field: string;
  row?: number;
  column?: string;
}

export interface AnnotationView {
  id: string;
  instanceId: string;
  nodeId: string;
  nodeName: string;
  visitId?: string;
  taskId?: string;
  author: UserInfo;
  status: AnnotationStatus;
  anchor?: unknown;
  content: string;
  audience: AnnotationAudience;
  parentId?: string;
  resolution?: AnnotationResolution;
  publishedAt?: string;
  createdAt?: string;
}

export type SaveAnnotationParams
  = | { id?: string; taskId: string; content: string; anchor?: unknown; audience?: AnnotationAudience }
    | { id?: string; parentId: string; resolution: AnnotationResolution; content: string };

export const APPROVAL_ERROR_CODES = {
  businessKindNotRegistered: 40_029,
  businessKindRequired: 40_030,
  annotationNotFound: 40_031,
  annotationNotEditable: 40_032,
  annotationAnchorInvalid: 40_033,
  annotationAudienceInvalid: 40_034,
  annotationNotAllowed: 40_035,
  voidNotAllowed: 40_036,
  instanceNotVoidable: 40_037,
  voidBlocked: 40_038,
  voidRequestPending: 40_039,
  voidPolicyInvalid: 40_040
} as const;
