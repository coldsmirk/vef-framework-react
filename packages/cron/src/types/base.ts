/**
 * Audit envelopes shared by the cron models. They mirror the Go
 * `orm.CreationAuditedModel` and `orm.FullAuditedModel` embeds: a management
 * list row carries the id and the audit fields the server projects.
 */
export interface CreationAudited {
  id: string;
  createdAt?: string;
  createdBy?: string;
}

export interface FullAudited extends CreationAudited {
  updatedAt?: string;
  updatedBy?: string;
}
