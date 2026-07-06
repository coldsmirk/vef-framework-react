import type { DeviceRegistries, ValidationIssue } from "@vef-framework-react/form-editor";

import type { ProjectionIssue } from "./issues";

import { validateSchema } from "@vef-framework-react/form-editor";

import { projectFormSchema } from "./project";

/**
 * A diagnostic from either layer of the save gate: form-editor's structural
 * validation or the bridge's projection. Both are `{ path, code, severity,
 * message }`-shaped, so hosts render them through one list.
 */
export type ApprovalSchemaIssue = ValidationIssue | ProjectionIssue;

export interface ApprovalSchemaValidationResult {
  valid: boolean;
  issues: ApprovalSchemaIssue[];
}

/**
 * Save-time gate for an approval-bound form schema: form-editor's
 * `validateSchema` (structural + registry membership) followed by the
 * approval projection (contract fit). Call before persisting or deploying —
 * the designer itself cannot enforce everything (e.g. a nested subform is
 * legal in a general-purpose form, and `initialSchema` is ingested without
 * validation), so this is the single choke point.
 *
 * The projection runs whenever the candidate parses into a schema, even if
 * structural errors were raised — hosts get the complete issue list in one
 * pass instead of fixing structure first and discovering contract violations
 * after.
 */
export function validateApprovalSchema(candidate: unknown, registries: DeviceRegistries): ApprovalSchemaValidationResult {
  const structural = validateSchema(candidate, registries);

  if (structural.schema === undefined) {
    return { valid: false, issues: structural.issues };
  }

  const projection = projectFormSchema(structural.schema);

  return {
    valid: structural.valid && projection.valid,
    issues: [...structural.issues, ...projection.issues]
  };
}
