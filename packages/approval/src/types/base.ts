/**
 * Audit envelopes shared by the approval models. They mirror the Go
 * `orm.FullAuditedModel` embed: a management list row carries the id and the
 * audit fields the server projects.
 */
export interface FullAudited {
  id: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * A person snapshot captured at action time, mirroring the Go
 * `approval.UserInfo` — the single person shape every approval projection
 * uses (task assignees, CC recipients, operators, applicants). Department
 * fields are present only when the host's `UserInfoResolver` fills them.
 */
export interface UserInfo {
  id: string;
  name: string;
  departmentId?: string;
  departmentName?: string;
}

/**
 * Form data as submitted / stored: a flat map keyed by field key. Values are
 * whatever the host's form schema produces — scalars, arrays (upload / table
 * rows), or nested row objects.
 */
export type FormDataValue = string | number | boolean | null | FormDataValue[] | { [key: string]: FormDataValue };

/**
 * The runtime form-data map of an instance.
 */
export type FormData = Record<string, FormDataValue>;
