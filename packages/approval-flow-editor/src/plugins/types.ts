import type { FC } from "react";

import type { AssigneeKind, CcKind, FormFieldDefinition, KindDescriptor } from "../types";

/**
 * Props for an external principal picker component. The editor only stores ids;
 * the picker owns its own display (resolving names, rendering chips, etc.).
 */
export interface PickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/**
 * Host-integration points injected by the business application.
 */
export interface EditorPlugins {
  /**
   * Pickers that resolve concrete ids, keyed by kind. A row looks up its own
   * kind first and falls back to its selection mode, so the three built-in
   * pickers (`user` / `role` / `department`) serve every kind that selects the
   * same thing — a host kind picking roles needs no picker of its own, while a
   * `custom` kind registers one under its own name. A kind left unset degrades
   * gracefully to an inline hint, so a host only wires the pickers it has.
   *
   * They also supply the value of a condition on a built-in applicant subject
   * (`applicantId` → user, `applicantDepartmentId` → department) for the
   * operators that compare a whole id, so those rules are picked rather than
   * typed. There a missing picker degrades to the free-text input instead of
   * the hint, since a hint would leave the rule unfillable.
   */
  pickers?: Partial<Record<string, FC<PickerProps>>>;
  /**
   * The assignee kinds this application accepts, from
   * `approval/flow.list_kind_options`. Omitted, the editor offers the
   * framework built-ins (`BUILTIN_ASSIGNEE_KINDS`) — correct for a host that
   * registers no kinds of its own, but a host that does must pass the served
   * catalog, or its kinds are simply absent from the dropdown.
   *
   * Each descriptor's `selection` drives the row's input: none renders
   * nothing, `form_field` a field-key input, and everything else the picker
   * resolved as described under {@link EditorPlugins.pickers}.
   */
  assigneeKinds?: ReadonlyArray<KindDescriptor<AssigneeKind>>;
  /**
   * The CC kinds this application accepts, with the same contract as
   * {@link EditorPlugins.assigneeKinds}.
   */
  ccKinds?: ReadonlyArray<KindDescriptor<CcKind>>;
  /**
   * Form field definitions, consumed by the condition editor, the
   * field-permission table, and flow validation (fieldPermissions keys are
   * cross-checked against this inventory).
   */
  formFields?: FormFieldDefinition[];
  /**
   * Host-defined global subjects the condition editor offers alongside the
   * built-in applicant attributes — variables the engine resolves from the
   * instance's globals snapshot (`Instance.Globals` on the backend, supplied
   * server-side by the host's `InstanceGlobalsResolver`) instead of form
   * data. `kind` drives the operator set and value input exactly as it does
   * for form fields; a key colliding with a built-in subject is dropped, and
   * a form field colliding with either is shadowed (mirroring the engine's
   * resolution order).
   *
   * So this is not the seam for making a built-in subject selectable — the
   * engine resolves those from the instance itself and ignores a same-named
   * global. Wire `pickers` instead; the condition editor uses them for the
   * built-in subjects' values.
   */
  globalSubjects?: FormFieldDefinition[];
}
