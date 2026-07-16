import type { FormRendererApi, FormSchema, PresentationDevice } from "@vef-framework-react/form-editor";
import type { RefObject } from "react";

import type { FieldPermission, FormData } from "../../types";

import { Empty } from "@vef-framework-react/components";
import { FormRenderer, RegistryProvider } from "@vef-framework-react/form-editor";

import { useApprovalPlugins } from "../../plugins";

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
 * come from `ApprovalProvider` (defaulting to the approval profile).
 */
export function InstanceFormPanel({
  schema,
  formData,
  fieldPermissions,
  disabled,
  device = "pc",
  apiRef,
  onSubmit
}: InstanceFormPanelProps) {
  const { registries } = useApprovalPlugins();

  if (!schema) {
    return <Empty description="该流程未配置表单" />;
  }

  return (
    <RegistryProvider registries={registries}>
      <FormRenderer
        apiRef={apiRef}
        defaultValues={formData}
        device={device}
        disabled={disabled}
        fieldPermissions={fieldPermissions}
        schema={schema}
        onSubmit={onSubmit}
      />
    </RegistryProvider>
  );
}
