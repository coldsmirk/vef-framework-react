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
  /**
   * The tenant to pick from. Set only for a user or department picker of a
   * shared flow whose host wired {@link EditorPlugins.tenants}: such a flow
   * routes work to people of other tenants than the one that starts it, so the
   * designer picks the tenant first and the picker lists that tenant's people.
   * Omitted, the picker lists whatever the host scopes it to by default.
   */
  tenantId?: string;
}

/**
 * One tenant a shared flow's rules can pick people from.
 */
export interface TenantOption {
  value: string;
  label: string;
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
  /**
   * The flow being edited is shared: offered to every tenant, so its work may
   * be routed to people of other tenants than the one that starts it. With
   * {@link EditorPlugins.tenants} wired, an assignee or CC rule that picks
   * users or departments then asks for a tenant first and hands it to the
   * picker. Roles and host catalogs are not per tenant and are picked as in
   * any flow.
   */
  shared?: boolean;
  /**
   * The tenants a shared flow's user and department rules can pick from. The
   * editor knows no tenant of its own; the host lists them. Ignored unless the
   * flow is {@link EditorPlugins.shared}; without it a shared flow picks people
   * through the plain pickers, scoped as the host scopes them.
   */
  tenants?: readonly TenantOption[];
}
