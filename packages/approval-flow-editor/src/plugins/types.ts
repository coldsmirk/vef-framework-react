import type { FC } from "react";

import type { FormFieldDefinition, PrincipalKind } from "../types";

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
   * Pickers that resolve concrete ids for each principal kind (user / role /
   * department). A kind left unset degrades gracefully to an inline hint, so a
   * host only wires the pickers it has.
   */
  pickers?: Partial<Record<PrincipalKind, FC<PickerProps>>>;
  /**
   * Form field definitions, consumed by the condition editor and the
   * field-permission table.
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
   */
  globalSubjects?: FormFieldDefinition[];
}
