import type { ColumnDataType } from "@vef-framework-react/form-editor";

/**
 * Field kind stored by the approval backend (`approval/form_definition.go`
 * `FieldKind` / `approval/enums.go`). The Go enum is the source of truth;
 * this union mirrors it literal-for-literal so drift fails the type-check at
 * every assignment site.
 */
export type ApprovalFieldKind
  = | "input"
    | "textarea"
    | "select"
    | "number"
    | "date"
    | "upload"
    | "table";

/**
 * A selectable option of a `select` field, mirroring the Go backend's
 * `FieldOption`. `value` is `unknown` because the Go side types it `any`;
 * the projector only ever writes `string | number`.
 */
export interface ApprovalFieldOption {
  label: string;
  value: unknown;
}

/**
 * Per-field validation rule, structurally equal to the Go backend's
 * `ValidationRule`. On a `table` field `minLength` / `maxLength` bound the
 * ROW COUNT rather than a string length.
 */
export interface ApprovalValidationRule {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

/**
 * A single form field flattened to the Go backend's `FormFieldDefinition`.
 * The field list IS the data model: under `table` storage each entry becomes
 * a column (each `table` field its own child table), under `json` storage a
 * JSONB key.
 *
 * `defaultValue` and `props` exist on the wire contract but are never emitted
 * by the projector today — the designer has no static default-value source,
 * and nothing consumes `props` yet. They are declared so hand-built or
 * host-enriched definitions round-trip losslessly.
 */
export interface ApprovalFormField {
  key: string;
  kind: ApprovalFieldKind;
  label: string;
  placeholder?: string;
  defaultValue?: unknown;
  isRequired?: boolean;
  options?: ApprovalFieldOption[];
  validation?: ApprovalValidationRule;
  props?: Record<string, unknown>;
  sortOrder: number;
  /**
   * Table-storage column type hint, honored when the flow version uses
   * `table` storage. Reuses form-editor's {@link ColumnDataType}, which
   * already mirrors the Go `ColumnDataType` enum.
   */
  columnType?: ColumnDataType;
  /**
   * Decimal scale, paired with `columnType: "decimal"`.
   */
  scale?: number;
  /**
   * Row shape of a detail-table field (`kind === "table"`). Single-level —
   * columns never nest another table (enforced by the Go deploy validation
   * and by the projector).
   */
  columns?: ApprovalFormField[];
}

/**
 * The flat form definition the approval backend deploys
 * (`DeployFlowCmd.FormDefinition`).
 */
export interface ApprovalFormDefinition {
  fields: ApprovalFormField[];
}
