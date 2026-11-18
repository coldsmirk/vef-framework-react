import type { ApprovalFormField } from "@vef-framework-react/approval-form-bridge";
import type { FormSchema } from "@vef-framework-react/form-editor";

import type { FieldAnchor, InstanceDetail } from "../../types";

import { projectFormSchema } from "@vef-framework-react/approval-form-bridge";

const fieldsBySchema = new WeakMap<FormSchema, Map<string, ApprovalFormField>>();

function fieldDefinition(schema: FormSchema, key: string) {
  let fields = fieldsBySchema.get(schema);

  if (!fields) {
    fields = new Map(projectFormSchema(schema).fields.map(field => [field.key, field]));
    fieldsBySchema.set(schema, fields);
  }

  return fields.get(key);
}

export function isFieldAnchor(anchor: unknown): anchor is FieldAnchor {
  return typeof anchor === "object" && anchor !== null && "field" in anchor && typeof anchor.field === "string"
    && (!("row" in anchor) || anchor.row === undefined || (typeof anchor.row === "number" && Number.isSafeInteger(anchor.row) && anchor.row >= 0))
    && (!("column" in anchor) || anchor.column === undefined || typeof anchor.column === "string");
}

export function anchorLabel(detail: InstanceDetail, anchor: unknown, scope?: FieldAnchor) {
  if (detail.instance.businessKind || !isFieldAnchor(anchor)) {
    return;
  }

  const field = detail.formSchema && fieldDefinition(detail.formSchema, anchor.field);
  const parts: string[] = [];

  if (scope?.field !== anchor.field) {
    parts.push(field?.label || anchor.field);
  }

  if (anchor.row !== undefined && scope?.row !== anchor.row) {
    parts.push(`第 ${anchor.row + 1} 行`);
  }

  if (anchor.column && scope?.column !== anchor.column) {
    parts.push(field?.columns?.find(column => column.key === anchor.column)?.label || anchor.column);
  }

  return parts.join(" · ");
}
