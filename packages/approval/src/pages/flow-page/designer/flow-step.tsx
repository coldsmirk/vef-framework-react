import type { EditorPlugins, FlowDefinition } from "@vef-framework-react/approval-flow-editor";

import { ApprovalFlowEditor } from "@vef-framework-react/approval-flow-editor";
import { globalCssVars } from "@vef-framework-react/components";

export interface FlowStepProps {
  /**
   * Seed definition; honored on the editor's first mount only.
   */
  value: FlowDefinition;
  plugins: EditorPlugins;
  onChange: (definition: FlowDefinition) => void;
}

/**
 * Step 3 — design the flow graph. The field-permission and condition
 * surfaces read the fields designed in step 2 via `plugins.formFields`. The
 * editor's own toolbar indicator lists the deploy-contract problems and
 * locates each one on the canvas, so the canvas keeps its full height; a
 * structurally invalid graph blocks completion from the wizard's footer.
 */
export function FlowStep({
  value,
  plugins,
  onChange
}: FlowStepProps) {
  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        border: `1px solid ${globalCssVars.colorBorderSecondary}`,
        borderRadius: 8,
        overflow: "hidden"
      }}
    >
      <ApprovalFlowEditor plugins={plugins} value={value} onChange={onChange} />
    </div>
  );
}
