import type { FlowDefinition } from "@vef-framework-react/approval-flow-editor";
import type { ApprovalFormDefinition } from "@vef-framework-react/approval-form-bridge";

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
 * Step 1 data — the `Flow` record (`approval/models.go` `Flow`).
 */
export interface FlowBasicInfo {
  code: string;
  name: string;
  categoryId?: string;
  icon?: string;
  description?: string;
  bindingMode: BindingMode;
  businessTable?: string;
  businessPkField?: string;
  businessStatusField?: string;
  /**
   * Optional write-back columns: when set, the engine keeps them in sync with
   * the instance (id / start time / finish time); when omitted the column is
   * never touched. Table, pk and status are mandatory in business mode.
   */
  businessInstanceIdField?: string;
  businessStartedAtField?: string;
  businessFinishedAtField?: string;
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
   * Step 2 → `DeployFlowCmd.FormDefinition`.
   */
  formDefinition: ApprovalFormDefinition;
  /**
   * Step 3 → `DeployFlowCmd.FlowDefinition`.
   */
  flowDefinition: FlowDefinition;
}
