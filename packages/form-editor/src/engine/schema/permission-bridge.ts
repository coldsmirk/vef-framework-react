import type { FieldOption, FormDataSource, FormField, FormSchema, PresentationLayer } from "../../types";

import { isKeyedField } from "../keys";
import { isRootScope, walkFields } from "./walk";

/**
 * Coarse field kind understood by the approval flow editor and the Go backend
 * (`approval/form_definition.go` `FieldKind`). The form editor's own field
 * types are richer; this is the lowest-common-denominator the cross-package
 * field-permission matrix keys off.
 */
export type FieldKind = "input" | "textarea" | "select" | "number" | "date" | "upload";

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
  options?: FieldOption[];
}

const KIND_BY_TYPE: Record<string, FieldKind> = {
  textfield: "input",
  "code-editor": "textarea",
  textarea: "textarea",
  number: "number",
  switch: "input",
  select: "select",
  radio: "select",
  "checkbox-group": "select",
  date: "date",
  datetime: "date",
  daterange: "date"
};

function fieldKind(type: string): FieldKind {
  return KIND_BY_TYPE[type] ?? "input";
}

/**
 * The static `{ label, value }` options a field exposes to the permission
 * matrix, if any. Covers an inline `static` source and a `ref` that points at a
 * form-level static data source. A `remote` source (inline or referenced) is
 * host-resolved at runtime, so its options are unknown here and omitted.
 */
function staticOptions(field: FormField, dataSources: Map<string, FormDataSource>): FieldOption[] | undefined {
  const source = "dataSource" in field ? field.dataSource : undefined;

  if (source?.kind === "static") {
    return source.options;
  }

  if (source?.kind === "ref") {
    const referenced = dataSources.get(source.dataSourceId);

    return referenced?.kind === "static" ? referenced.options : undefined;
  }

  return undefined;
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
  const seen = new Set<string>();
  const dataSources = new Map((schema.dataSources ?? []).map(source => [source.id, source]));

  const collect = (layer: PresentationLayer | undefined): void => {
    if (layer === undefined) {
      return;
    }

    walkFields(layer, (field, scope) => {
      if (!isRootScope(scope) || !isKeyedField(field) || seen.has(field.key)) {
        return;
      }

      seen.add(field.key);

      const options = staticOptions(field, dataSources);

      definitions.push({
        key: field.key,
        kind: fieldKind(field.type),
        label: field.label ?? field.key,
        ...options ? { options } : {}
      });
    });
  };

  collect(schema.presentations.pc);
  collect(schema.presentations.mobile);

  return definitions;
}
