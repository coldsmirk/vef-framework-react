import type { FormRendererApi, FormSchema, PresentationDevice } from "@vef-framework-react/form-editor";
import type { RefObject } from "react";

import type { FieldPermission, FormData, UserInfo } from "../../types";

import { Empty } from "@vef-framework-react/components";
import { FormRenderer, RegistryProvider } from "@vef-framework-react/form-editor";
import { useMemo } from "react";

import { useApprovalPlugins } from "../../plugins";
import { toFormEvaluationContext } from "../../plugins/form-context";

export interface InstanceFormPanelProps {
  /**
   * The version-pinned host form-designer document. Absent for flows without
   * a form — renders an empty state.
   */
  schema?: FormSchema;
  /**
   * The instance's form data (already stripped server-side of fields this
   * viewer may not see).
   */
  formData?: FormData;
  /**
   * The server-resolved per-field interactivity clamp, applied verbatim.
   */
  fieldPermissions?: Record<string, FieldPermission>;
  /**
   * The instance's applicant — the form's `$applicant`. On the start form it
   * is the snapshot the instance is about to record; everywhere else it is the
   * instance's own, so a rule about the initiator reads the same initiator for
   * every participant who opens the form.
   */
  applicant?: UserInfo;
  /**
   * The form-visible host globals — the form's `$globals`.
   */
  globals?: Record<string, unknown>;
  /**
   * Force the whole form read-only (viewers with nothing to execute).
   */
  disabled?: boolean;
  device?: PresentationDevice;
  /**
   * Imperative handle: `submit()` runs the renderer's validation + submit
   * pipeline, `getSubmitValues()` reads the writable subset without
   * validating (the reject path).
   */
  apiRef?: RefObject<FormRendererApi | null>;
  onSubmit?: (values: Record<string, unknown>) => void;
}

/**
 * The instance form, rendered against the version-pinned schema with the
 * viewer's field permissions clamped on: `hidden` unmounts, `visible` renders
 * read-only, `editable`/`required` grant write strength. Field registries
 * come from `ApprovalProvider` (defaulting to the approval profile); the
 * applicant and the form-visible globals form its evaluation context.
 */
export function InstanceFormPanel({
  schema,
  formData,
  fieldPermissions,
  applicant,
  globals,
  disabled,
  device = "pc",
  apiRef,
  onSubmit
}: InstanceFormPanelProps) {
  const {
    dataSourceResolver,
    evaluators,
    registries
  } = useApprovalPlugins();
  const evaluationContext = useMemo(() => toFormEvaluationContext(applicant, globals), [applicant, globals]);

  if (!schema) {
    return <Empty description="该流程未配置表单" />;
  }

  return (
    <RegistryProvider registries={registries}>
      <FormRenderer
        apiRef={apiRef}
        dataSourceResolver={dataSourceResolver}
        defaultValues={formData}
        device={device}
        disabled={disabled}
        evaluationContext={evaluationContext}
        evaluators={evaluators}
        fieldPermissions={fieldPermissions}
        schema={schema}
        onSubmit={onSubmit}
      />
    </RegistryProvider>
  );
}
