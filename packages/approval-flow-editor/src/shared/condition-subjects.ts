import type { FormFieldDefinition } from "../types";

/**
 * Applicant attributes the engine resolves from the instance context instead
 * of form data. They share the field-condition pipeline (same operators as a
 * text field), so the picker offers them alongside the form fields. These
 * subjects are reserved names for scalar comparisons — a scalar form field with
 * a colliding key is shadowed, and so is a host global (the engine resolves the built-ins
 * first), which is deliberate: the same instance column drives assignee
 * resolution and the initiator check, so a global able to redefine it for
 * condition routing alone would split one "department" into two values.
 */
export const BUILT_IN_SUBJECT_FIELDS: FormFieldDefinition[] = [
  {
    key: "applicantId",
    kind: "input",
    label: "发起人 ID"
  },
  {
    key: "applicantDepartmentId",
    kind: "input",
    label: "发起人部门 ID"
  }
];

/**
 * A scalar and a table aggregate can share a wire subject but select different sources.
 */
export function subjectOptionValue(key: string, aggregate: boolean): string {
  return `${aggregate ? "table" : "scalar"}:${key}`;
}

export function conditionSubjectOptions(formFields: FormFieldDefinition[] = [], globals: FormFieldDefinition[] = []) {
  const contextFields = [
    ...BUILT_IN_SUBJECT_FIELDS,
    ...globals.filter(field => BUILT_IN_SUBJECT_FIELDS.every(builtin => builtin.key !== field.key))
  ];
  const contextKeys = new Set(contextFields.map(field => field.key));
  const scalarContext = contextFields.filter(field => field.kind !== "table");
  const tables = new Set(formFields.filter(field => field.kind === "table").map(field => field.key));
  const collidingKeys = new Set(scalarContext.filter(field => tables.has(field.key)).map(field => field.key));
  const fields = [...scalarContext, ...formFields.filter(field => field.kind === "table" || !contextKeys.has(field.key))];

  return fields.map(field => {
    const aggregate = field.kind === "table";
    const label = collidingKeys.has(field.key) ? `${field.label}（${aggregate ? "明细表" : "流程变量"}）` : field.label;
    return {
      field,
      value: subjectOptionValue(field.key, aggregate),
      label
    };
  });
}
