import type { FlowDefinition } from "@vef-framework-react/approval-flow-editor";

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
 * Coarse field kind the backend stores (`approval/form_definition.go`
 * `FieldKind`).
 */
export type BackendFieldKind = "input" | "textarea" | "select" | "number" | "date" | "upload";

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
  businessTitleField?: string;
  businessStatusField?: string;
  adminUserIds: string[];
  isAllInitiationAllowed: boolean;
  instanceTitleTemplate: string;
}

/**
 * Per-field validation rule, structurally equal to the backend
 * `ValidationRule` (`approval/form_definition.go`).
 */
export interface BackendValidationRule {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface BackendFieldOption {
  label: string;
  value: string | number;
}

/**
 * A single form field flattened to the backend's `FormFieldDefinition`. The
 * field list IS the data model: in `table` storage mode each entry becomes a
 * column, in `json` mode a JSONB key.
 */
export interface BackendFormFieldDefinition {
  key: string;
  kind: BackendFieldKind;
  label: string;
  placeholder?: string;
  defaultValue?: unknown;
  isRequired?: boolean;
  options?: BackendFieldOption[];
  validation?: BackendValidationRule;
  sortOrder: number;
}

export interface BackendFormDefinition {
  fields: BackendFormFieldDefinition[];
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
  formDefinition: BackendFormDefinition;
  /**
   * Step 3 → `DeployFlowCmd.FlowDefinition`.
   */
  flowDefinition: FlowDefinition;
}
