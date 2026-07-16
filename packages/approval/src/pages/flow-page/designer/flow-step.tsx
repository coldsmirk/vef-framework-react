import type { EditorPlugins, FlowDefinition, FlowValidationError } from "@vef-framework-react/approval-flow-editor";

import { ApprovalFlowEditor } from "@vef-framework-react/approval-flow-editor";
import { Alert, globalCssVars, Stack } from "@vef-framework-react/components";

export interface FlowStepProps {
  /**
   * Seed definition; honored on the editor's first mount only.
   */
  value: FlowDefinition;
  plugins: EditorPlugins;
  errors: FlowValidationError[];
  onChange: (definition: FlowDefinition) => void;
}

/**
 * Step 3 — design the flow graph. The field-permission and condition
 * surfaces read the fields designed in step 2 via `plugins.formFields`; a
 * structurally invalid graph blocks completion.
 */
export function FlowStep({
  value,
  plugins,
  errors,
  onChange
}: FlowStepProps) {
  return (
    <Stack gap={8} style={{ height: "100%", minHeight: 0 }}>
      {errors.length > 0 && (
        <Alert
          showIcon
          title={`流程校验未通过（${errors.length} 项）`}
          type="error"
          description={(
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {/* Errors have no identity beyond their occurrence order. */}
              {errors.map((error, index) => <li key={index}>{error.message}</li>)}
            </ul>
          )}
        />
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: `1px solid ${globalCssVars.colorBorderSecondary}`,
          borderRadius: 8,
          overflow: "hidden"
        }}
      >
        <ApprovalFlowEditor plugins={plugins} value={value} onChange={onChange} />
      </div>
    </Stack>
  );
}
