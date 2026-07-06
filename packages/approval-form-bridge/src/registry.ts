import type { DeviceRegistries } from "@vef-framework-react/form-editor";

import { createDefaultMobileRegistry, createDefaultRegistry } from "@vef-framework-react/form-editor";

/**
 * Widget types the approval profile removes from the default registries.
 *
 * - `switch` / `daterange`: bind values (boolean / [start, end] array) the
 * approval contract cannot carry — see the projector's `KIND_BY_TYPE`.
 * - `button`: binds no value, but its `submit` / `reset` actions fight the
 * approval shell's own submission control.
 *
 * A host that disagrees builds its own registries instead of calling
 * {@link createApprovalRegistries}.
 */
export const APPROVAL_EXCLUDED_FIELD_TYPES = ["switch", "daterange", "button"] as const;

/**
 * Build the approval-profile device registries: the form-editor defaults
 * minus {@link APPROVAL_EXCLUDED_FIELD_TYPES}. Because the palette listing,
 * the schema-import validation, and the properties panel all derive from the
 * registry, passing this to `<FormEditor registries={...}>` keeps the
 * excluded widgets out of the designer entirely — a user cannot author a
 * form the approval backend would reject on those types.
 *
 * Returns fresh instances on every call; the `registries` prop is honored on
 * first mount only, so memoize the result (`useState(createApprovalRegistries)`).
 */
export function createApprovalRegistries(): DeviceRegistries {
  const pc = createDefaultRegistry();
  const mobile = createDefaultMobileRegistry();

  for (const type of APPROVAL_EXCLUDED_FIELD_TYPES) {
    pc.unregister(type);
    mobile.unregister(type);
  }

  return { pc, mobile };
}
