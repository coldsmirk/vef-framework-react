import type { FlowDefinition } from "@vef-framework-react/approval-flow-editor";
import type { FormSchema } from "@vef-framework-react/form-editor";

/**
 * Form-data storage mode, aligned with the backend `FlowVersion.StorageMode`
 * (`approval/enums.go`). `json` keeps form data in `apv_instance.form_data`
 * JSONB; `table` materialises a dynamic table whose columns are the form fields.
 */
export type StorageMode = "json" | "table";

/**
 * Flow-to-business binding, aligned with the backend `Flow.BindingMode`.
 * `standalone` stores form data in the approval system; `business` links an
 * existing business table.
 */
export type BindingMode = "standalone" | "business";

/**
 * Kind of flow initiator, aligned with the backend `InitiatorKind`. Each kind
 * needs a host-provided picker to resolve concrete ids.
 */
export type InitiatorKind = "user" | "role" | "department";

/**
 * Flow initiator entry (flow-scoped — `apv_flow_initiator`).
 */
export interface FlowInitiator {
  kind: InitiatorKind;
  ids: string[];
}

/**
 * Instance statuses the engine projects into the business status column,
 * aligned with the backend `isProjectableStatus`
 * (`internal/approval/binding/config_validator.go`).
 */
export type ProjectableInstanceStatus
  = | "running"
    | "approved"
    | "rejected"
    | "withdrawn"
    | "returned"
    | "terminated";

/**
 * Business binding for a `business`-mode flow, aligned with the backend
 * `approval.BusinessBindingConfig` (`approval/binding.go`). All table / column
 * names must be plain SQL identifiers (`^[A-Za-z_][A-Za-z0-9_]{0,62}$`).
 */
export interface BusinessBindingConfig {
  tableName: string;
  /**
   * Columns identifying the bound record — must exactly match a non-null
   * primary or unique key on `tableName` (composite keys supported).
   */
  keyColumns: string[];
  statusColumn: string;
  /**
   * Mandatory: the engine uses it as a compare-and-set fence so a stale
   * instance cannot overwrite the state owned by a newer approval round.
   */
  instanceIdColumn: string;
  startedAtColumn?: string;
  finishedAtColumn?: string;
  /**
   * Translates instance statuses into host business status values. Missing
   * entries fall back to the instance-status string itself.
   */
  statusMapping?: Partial<Record<ProjectableInstanceStatus, string>>;
}

/**
 * Step 1 data — the `Flow` record (`approval/models.go` `Flow`).
 */
export interface FlowBasicInfo {
  code: string;
  name: string;
  categoryId?: string;
  icon?: string;
  description?: string;
  bindingMode: BindingMode;
  /**
   * Required in `business` mode, forbidden in `standalone` mode — the backend
   * rejects a half-configured or unexpected binding at save time
   * (`ErrBindingIncomplete` / `ErrBindingUnexpected`).
   */
  businessBinding?: BusinessBindingConfig;
  adminUserIds: string[];
  isAllInitiationAllowed: boolean;
  instanceTitleTemplate: string;
}

/**
 * The full payload the wizard emits on completion, aligned with the backend
 * create → deploy → publish sequence. The wizard is purely controlled: it
 * assembles this object and hands it to the host, which performs the actual API
 * calls (`CreateFlowCmd` → `DeployFlowCmd` → `PublishVersionCmd`).
 */
export interface FlowDesignPayload {
  /**
   * Step 1 → `CreateFlowCmd` (Flow record).
   */
  basic: FlowBasicInfo;
  /**
   * Step 1 → `CreateFlowCmd.Initiators` (flow-scoped).
   */
  initiators: FlowInitiator[];
  /**
   * Step 2 → `FlowVersion.StorageMode`.
   */
  storageMode: StorageMode;
  /**
   * Step 2 → `DeployFlowCmd.FormSchema`, sent as raw JSON. The rich
   * form-editor document is stored verbatim server-side; the backend derives
   * the flat field list itself at deploy (`internal/approval/formeditor`).
   * `null` — no form was designed — deploys a flow without a form.
   */
  formSchema: FormSchema | null;
  /**
   * Step 3 → `DeployFlowCmd.FlowDefinition`.
   */
  flowDefinition: FlowDefinition;
}
