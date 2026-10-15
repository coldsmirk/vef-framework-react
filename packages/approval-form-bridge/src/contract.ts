import type { ColumnDataType, RemoteDataSourceRequest, RemoteOptionMapping } from "@vef-framework-react/form-editor";

/**
 * Field kind stored by the approval backend (`approval/form_field.go`
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
 * Where a selection field's options come from, when the projection could not
 * enumerate them into `options`. Mirrors the Go backend's `OptionSourceKind`.
 *
 * The designer's source union also carries `static` and `ref`, but neither
 * survives projection: a static source — inline or reached through a `ref` — is
 * enumerated into `options`, and a `ref` is dereferenced to whatever it points
 * at. Only a source that stays unresolved is emitted here, so this vocabulary is
 * deliberately narrower than the designer's.
 */
export type ApprovalOptionSourceKind = "remote" | "codeSet";

/**
 * An option source the projection could not enumerate, post-dereference: a
 * consumer never chases a `dataSourceId`. Mirrors the Go `FieldOptionSource`.
 *
 * A `remote` source carries `request` and `mapping`, which reuse the
 * form-editor's own types; the Go `RemoteOptionRequest` / `RemoteOptionMapping`
 * mirror them field for field — including `request.params`, carried
 * UNEVALUATED (each parameter a literal or an expression bound to the live
 * form), because neither the backend nor a list-rendering consumer holds the
 * form values an expression reads. `request` is optional only because the
 * projector emits a source whose request the designer left unset rather than
 * silently dropping it; the Go deploy validation rejects that document, so a
 * deployed version always carries one.
 *
 * A `codeSet` source carries `codeSet`, the host data dictionary the options
 * come from. Unlike a remote source it is checked: the backend validates a
 * submitted value against that dictionary when the host registers a code-set
 * loader, and a list view translates a stored value with one lookup.
 */
export interface ApprovalFieldOptionSource {
  kind: ApprovalOptionSourceKind;
  request?: RemoteDataSourceRequest;
  mapping?: RemoteOptionMapping;
  codeSet?: string;
}

/**
 * A single form field flattened to the Go backend's `FormFieldDefinition`
 * (`approval/form_field.go`). The contract's top-level artifact is a bare
 * `ApprovalFormField[]` — there is no wrapper object. The field list IS the
 * data model: under `table` storage each entry becomes a column (each `table`
 * field its own child table), under `json` storage a JSONB key.
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
  /**
   * Where the options come from when they could not be enumerated into
   * `options`. The backend never resolves it — select validation reads
   * `options` and accepts any value when there are none — so it exists for
   * consumers that must render a stored value as its label.
   */
  optionSource?: ApprovalFieldOptionSource;
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
