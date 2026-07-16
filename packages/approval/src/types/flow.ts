import type { FlowDefinition, FormFieldDefinition } from "@vef-framework-react/approval-flow-editor";
import type { FormSchema } from "@vef-framework-react/form-editor";

import type { FullAudited } from "./base";
import type { BindingMode, InitiatorKind, InstanceStatus, StorageMode, VersionStatus } from "./enums";

/**
 * Business binding for a `business`-mode flow, mirroring the Go
 * `approval.BusinessBindingConfig`. All table / column names must be plain
 * SQL identifiers; `keyColumns` must exactly match a complete, non-null
 * primary or unique key on `tableName`.
 */
export interface BusinessBindingConfig {
  tableName: string;
  keyColumns: string[];
  statusColumn: string;
  /**
   * Mandatory for business bindings: the engine uses it as a compare-and-set
   * fence so a stale instance cannot overwrite the state owned by a newer
   * approval round.
   */
  instanceIdColumn?: string;
  startedAtColumn?: string;
  finishedAtColumn?: string;
  /**
   * Translates instance statuses into host business status values. Missing
   * entries fall back to the instance-status string itself.
   */
  statusMapping?: Partial<Record<InstanceStatus, string>>;
}

/**
 * A flow definition record, mirroring the Go `approval.Flow`.
 */
export interface Flow extends FullAudited {
  tenantId: string;
  categoryId: string;
  code: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  /**
   * Host-owned selection metadata (e.g. which app a flow belongs to, mobile
   * availability). The framework stores them verbatim and offers equality
   * filtering in the flow list queries; keys are restricted server-side to
   * `^[A-Za-z0-9]([A-Za-z0-9_-]*[A-Za-z0-9])?$` (≤63 chars), values to 256
   * characters.
   */
  labels?: Record<string, string>;
  bindingMode: BindingMode;
  businessBinding?: BusinessBindingConfig | null;
  adminUserIds: string[];
  isAllInitiationAllowed: boolean;
  instanceTitleTemplate: string;
  isActive: boolean;
  currentVersion: number;
}

/**
 * A versioned snapshot of a flow definition, mirroring `approval.FlowVersion`.
 */
export interface FlowVersion extends FullAudited {
  flowId: string;
  version: number;
  status: VersionStatus;
  description?: string | null;
  storageMode: StorageMode;
  flowSchema?: FlowDefinition | null;
  /**
   * The host-owned form designer document, returned verbatim.
   */
  formSchema?: FormSchema | null;
  /**
   * The flat field list derived from `formSchema` at deploy — the only form
   * shape the framework itself consumes.
   */
  formFields?: FormFieldDefinition[] | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  businessBinding?: BusinessBindingConfig | null;
}

/**
 * The version-list projection of a flow version, mirroring
 * `shared.FlowVersionSummary`: identity and lifecycle metadata without the
 * definition payloads. A single version's full definition is fetched through
 * `get_graph` with an explicit `versionId`.
 */
export interface FlowVersionSummary {
  id: string;
  flowId: string;
  version: number;
  status: VersionStatus;
  description?: string | null;
  storageMode: StorageMode;
  publishedAt?: string | null;
  publishedBy?: string | null;
  createdAt: string;
  createdBy: string;
}

/**
 * A flow initiator rule, mirroring `approval.FlowInitiator`.
 */
export interface FlowInitiator {
  id: string;
  flowId: string;
  kind: InitiatorKind;
  ids: string[];
}

/**
 * An initiator rule as submitted with create/update.
 */
export interface InitiatorParams {
  kind: InitiatorKind;
  ids: string[];
}

/**
 * Parameters for `approval/flow.create`.
 */
export interface CreateFlowParams {
  tenantId: string;
  code: string;
  name: string;
  categoryId: string;
  icon?: string;
  description?: string;
  labels?: Record<string, string>;
  bindingMode: BindingMode;
  businessBinding?: BusinessBindingConfig;
  adminUserIds?: string[];
  isAllInitiationAllowed: boolean;
  instanceTitleTemplate: string;
  initiators?: InitiatorParams[];
}

/**
 * Parameters for `approval/flow.update`. Omitted `labels` clears the stored
 * set (full replace semantics).
 */
export interface UpdateFlowParams {
  flowId: string;
  name: string;
  icon?: string;
  description?: string;
  labels?: Record<string, string>;
  bindingMode: BindingMode;
  businessBinding?: BusinessBindingConfig;
  adminUserIds?: string[];
  isAllInitiationAllowed: boolean;
  instanceTitleTemplate: string;
  initiators?: InitiatorParams[];
}

/**
 * Parameters for `approval/flow.deploy` — creates a new draft version from
 * the designed definition. `formSchema` is the host-owned designer document,
 * passed through opaque and optional (flows without forms exist).
 */
export interface DeployFlowParams {
  flowId: string;
  description?: string;
  storageMode?: StorageMode;
  flowDefinition: FlowDefinition;
  formSchema?: FormSchema;
}

/**
 * Parameters for `approval/flow.publish_version`.
 */
export interface PublishVersionParams {
  versionId: string;
}

/**
 * Parameters for `approval/flow.toggle_active`.
 */
export interface ToggleFlowActiveParams {
  flowId: string;
  isActive: boolean;
}

/**
 * Search parameters for `approval/flow.find_flows`. Label filters are
 * equality predicates, AND-combined across pairs.
 */
export interface FlowSearch {
  tenantId?: string;
  categoryId?: string;
  keyword?: string;
  isActive?: boolean;
  labels?: Record<string, string>;
}

/**
 * The definition bundle returned by `approval/flow.get_graph`: the flow
 * record and the resolved version (carrying `flowSchema` / `formSchema`) —
 * the latest published version by default, or the version named by
 * `versionId` (the designer's edit seed).
 */
export interface FlowGraphBundle {
  flow: Flow | null;
  version: FlowVersion | null;
}
