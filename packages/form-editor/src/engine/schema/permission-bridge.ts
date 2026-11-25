import type { DateGranularity, FieldOption, FormDataSource, FormField, FormSchema } from "../../types";

import { walkUniqueRootKeyedFields } from "../keys";
import { flattenSelectableOptions } from "../options";

/**
 * Coarse field kind understood by the approval flow editor and the Go backend
 * (`approval/enums.go` `FieldKind`). The form editor's own field
 * types are richer; this is the lowest-common-denominator the cross-package
 * field-permission matrix keys off.
 *
 * For approval-backend integrations use `projectFormSchema` from
 * `@vef-framework-react/approval-form-bridge` instead — its mapping is the
 * authoritative one there. This table intentionally stays lossy (switch
 * collapses into a nearest kind, subforms are excluded, unknown types fall back
 * to "input") because a permission row only needs a rough label, while the
 * bridge must reject what the backend cannot carry.
 */
export type FieldKind = "input" | "textarea" | "select" | "number" | "date" | "datetime" | "daterange" | "upload";

/**
 * A form field flattened to the shape the approval flow editor consumes through
 * its `EditorPlugins.formFields` seam (structurally equal to the backend's
 * `FormFieldDefinition`). The approval side renders one permission row per entry,
 * keyed by `key`.
 */
export interface FormFieldDefinition {
  key: string;
  kind: FieldKind;
  label: string;
  isMultiple?: boolean;
  granularity?: DateGranularity;
  options?: FieldOption[];
}

const KIND_BY_TYPE: Record<string, FieldKind> = {
  textfield: "input",
  "code-editor": "textarea",
  textarea: "textarea",
  number: "number",
  switch: "input",
  select: "select",
  "multi-select": "select",
  "tree-select": "select",
  "tree-multi-select": "select",
  radio: "select",
  "checkbox-group": "select",
  date: "date",
  datetime: "datetime",
  daterange: "daterange",
  upload: "upload"
};

const MULTI_VALUE_SELECT_TYPES: ReadonlySet<string> = new Set([
  "checkbox-group",
  "multi-select",
  "tree-multi-select"
]);

function fieldKind(type: string): FieldKind {
  // Own-property guarded: a consumer-registered widget named like an Object
  // prototype member ("constructor", "toString") would otherwise read a
  // function out of the table and hand it back typed as a FieldKind.
  const mapped = Object.hasOwn(KIND_BY_TYPE, type) ? KIND_BY_TYPE[type] : undefined;

  return mapped ?? "input";
}

/**
 * The static `{ label, value }` options a field exposes to the permission
 * matrix, if any. Covers an inline `static` source and a `ref` that points at a
 * form-level static data source. A `remote` source (inline or referenced) and
 * a `codeSet` one are host-resolved at runtime, so their options are unknown
 * here and omitted.
 */
function staticOptions(field: FormField, dataSources: Map<string, FormDataSource>): FieldOption[] | undefined {
  const source = "dataSource" in field ? field.dataSource : undefined;
  let rawOptions: FieldOption[] | undefined;

  if (source?.kind === "static") {
    rawOptions = source.options;
  } else if (source?.kind === "ref") {
    const referenced = dataSources.get(source.dataSourceId);

    rawOptions = referenced?.kind === "static" ? referenced.options : undefined;
  }

  if (rawOptions === undefined) {
    return undefined;
  }

  if (field.type === "tree-select" || field.type === "tree-multi-select") {
    return flattenSelectableOptions(rawOptions, { leafOnly: field.leafOnly === true }).map(option => {
      return { label: option.label, value: option.value };
    });
  }

  return rawOptions.map(option => {
    return { label: option.label, value: option.value };
  });
}

/**
 * Flatten a form schema to the field inventory the approval flow editor needs
 * to drive its per-node field-permission matrix. Only root-scope keyed leaf
 * fields are emitted: the matrix (and the backend's `FilterEditableFormData`)
 * address fields by their bare `key`, which cannot reach a subform-template
 * field's scoped key — those are intentionally excluded. Non-keyed presentation
 * fields (divider / alert / button) carry no value and are skipped.
 *
 * Both device presentations are scanned and de-duplicated by `key`: the data
 * contract is shared, so any field present on either device contributes a
 * permission row. The pc tree is scanned first, so it wins a label collision.
 *
 * The form editor owns this derivation; the approval editor owns the matrix UI;
 * the backend owns enforcement. A host wires the three together by passing the
 * result into `EditorPlugins.formFields`.
 */
export function toFormFieldDefinitions(schema: FormSchema): FormFieldDefinition[] {
  const definitions: FormFieldDefinition[] = [];
  const dataSources = new Map((schema.dataSources ?? []).map(source => [source.id, source]));

  walkUniqueRootKeyedFields(schema, field => {
    const options = staticOptions(field, dataSources);
    const isMultiple = MULTI_VALUE_SELECT_TYPES.has(field.type);
    const granularity = (field.type === "date" || field.type === "daterange")
      ? (field as { granularity?: DateGranularity }).granularity
      : undefined;

    definitions.push({
      key: field.key,
      kind: fieldKind(field.type),
      label: field.label ?? field.key,
      ...isMultiple && { isMultiple },
      ...granularity !== undefined && { granularity },
      ...options && { options }
    });
  });

  return definitions;
}
