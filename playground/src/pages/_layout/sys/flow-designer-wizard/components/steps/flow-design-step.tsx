import type { EditorPlugins, FlowDefinition, FlowValidationError } from "@vef-framework-react/approval-flow-editor";
import type { FC } from "react";

import { ApprovalFlowEditor } from "@vef-framework-react/approval-flow-editor";

interface FlowDesignStepProps {
  value: FlowDefinition;
  plugins: EditorPlugins;
  errors: FlowValidationError[];
  onChange: (definition: FlowDefinition) => void;
}

/**
 * Step 3 — design the flow graph with the existing approval-flow-editor. The
 * field-permission and condition surfaces read the fields designed in step 2 via
 * `plugins.formFields`. A structurally invalid graph blocks completion.
 */
export const FlowDesignStep: FC<FlowDesignStepProps> = ({
  value,
  plugins,
  errors,
  onChange
}) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    gap: 8
  }}
  >
    {errors.length > 0 && (
      <div style={{
        padding: "8px 12px",
        borderRadius: 8,
        background: "var(--vef-color-error-bg)",
        border: "1px solid var(--vef-color-error-border)",
        color: "var(--vef-color-error)",
        fontSize: 12
      }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          流程校验未通过(
          {errors.length}
          ):
        </div>

        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {errors.map((error, index) => <li key={index}>{error.message}</li>)}
        </ul>
      </div>
    )}

    <div style={{
      flex: 1,
      minHeight: 0,
      border: "1px solid var(--vef-color-border-secondary)",
      borderRadius: 8,
      overflow: "hidden"
    }}
    >
      <ApprovalFlowEditor plugins={plugins} value={value} onChange={onChange} />
    </div>
  </div>
);
