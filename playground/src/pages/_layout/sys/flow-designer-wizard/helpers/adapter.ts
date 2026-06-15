import type { FormField, FormSchema, Validatable } from "@vef-framework-react/form-editor";

import type { BackendFormDefinition, BackendFormFieldDefinition } from "../types";

import { isKeyedField, toFormFieldDefinitions, walkFields } from "@vef-framework-react/form-editor";

/**
 * Read a field's optional `placeholder` without enumerating every field type —
 * mirrors the structural-read style of form-editor's own permission-bridge.
 */
function placeholderOf(field: FormField): string | undefined {
  return (field as { placeholder?: string }).placeholder;
}

/**
 * Flatten a designed form schema into the backend's flat `FormDefinition`
 * (`approval/form_definition.go`). Only root-scope keyed leaf fields become
 * columns — subform-scoped fields and non-keyed presentation are excluded, the
 * same projection the field-permission matrix uses. The coarse `kind` mapping is
 * reused from `toFormFieldDefinitions` to avoid drift; this adds the richer
 * per-field attributes (placeholder / required / validation) the backend stores.
 */
export function toBackendFormDefinition(schema: FormSchema): BackendFormDefinition {
  const byKey = new Map<string, FormField>();

  // Mirror toFormFieldDefinitions's projection: root-scope keyed fields across
  // both device presentations, deduped by key with pc winning a collision (it is
  // walked first). walkFields operates on one PresentationLayer at a time.
  for (const layer of [schema.presentations.pc, schema.presentations.mobile]) {
    if (layer === undefined) {
      continue;
    }

    walkFields(layer, (field, scope) => {
      if (scope.length === 0 && isKeyedField(field) && !byKey.has(field.key)) {
        byKey.set(field.key, field);
      }
    });
  }

  const fields: BackendFormFieldDefinition[] = toFormFieldDefinitions(schema).map((definition, index) => {
    const field = byKey.get(definition.key);
    const { required, ...rule } = (field as Validatable | undefined)?.validate ?? {};
    const placeholder = field ? placeholderOf(field) : undefined;
    const hasRule = Object.values(rule).some(value => value !== undefined);

    return {
      key: definition.key,
      kind: definition.kind,
      label: definition.label,
      sortOrder: index,
      ...placeholder ? { placeholder } : {},
      ...required ? { isRequired: true } : {},
      ...definition.options ? { options: definition.options } : {},
      ...hasRule ? { validation: rule } : {}
    };
  });

  return { fields };
}
