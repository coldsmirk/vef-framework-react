import type { FormFieldDefinition } from "../types";

/**
 * Applicant attributes the engine resolves from the instance context instead
 * of form data. They share the field-condition pipeline (same operators as a
 * text field), so the picker offers them alongside the form fields. These
 * subjects are reserved names on the backend — a form field with a colliding
 * key is shadowed, and so is a host global (the engine resolves the built-ins
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
