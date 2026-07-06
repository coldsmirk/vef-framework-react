import type { EditorPlugins, FlowDefinition } from "@vef-framework-react/approval-flow-editor";
import type { FormSchema } from "@vef-framework-react/form-editor";
import type { CSSProperties, FC } from "react";

import type { FlowBasicInfo, FlowDesignPayload, FlowInitiator, StorageMode } from "../types";

import { validateFlowDefinition } from "@vef-framework-react/approval-flow-editor";
import { projectFormSchema } from "@vef-framework-react/approval-form-bridge";
import { Button, Steps } from "@vef-framework-react/components";
import { useCallback, useMemo, useState } from "react";

import { BasicInfoStep } from "./steps/basic-info-step";
import { FlowDesignStep } from "./steps/flow-design-step";
import { FormDesignStep } from "./steps/form-design-step";
import { ReviewStep } from "./steps/review-step";

const STEP_ITEMS = [
  { title: "基本信息" },
  { title: "表单与数据模型" },
  { title: "流程设计" },
  { title: "完成" }
];

const DEFAULT_BASIC: FlowBasicInfo = {
  code: "",
  name: "",
  bindingMode: "standalone",
  adminUserIds: [],
  isAllInitiationAllowed: false,
  instanceTitleTemplate: ""
};

const EMPTY_FLOW: FlowDefinition = { nodes: [], edges: [] };

export interface FlowDesignerWizardInitialValue {
  basic?: Partial<FlowBasicInfo>;
  initiators?: FlowInitiator[];
  storageMode?: StorageMode;
  flowDefinition?: FlowDefinition;
}

export interface FlowDesignerWizardProps {
  initialValue?: FlowDesignerWizardInitialValue;
  /**
   * Host pickers (user / role / department), threaded to the step-1 initiators
   * editor and the step-3 graph editor. `formFields` is derived from step 2.
   */
  plugins?: EditorPlugins;
  onComplete: (payload: FlowDesignPayload) => void;
}

function stepPaneStyle(active: boolean, scrollable: boolean): CSSProperties {
  return {
    display: active ? "flex" : "none",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    overflow: scrollable ? "auto" : "hidden",
    padding: scrollable ? "28px 48px" : "0 24px"
  };
}

/**
 * Purely-controlled wizard that orchestrates a complete approval-flow design:
 * basic info + initiators → form / data model → flow graph → review. It
 * assembles a backend-aligned {@link FlowDesignPayload} and hands it to the host
 * via `onComplete`; it performs no network calls itself.
 */
export const FlowDesignerWizard: FC<FlowDesignerWizardProps> = ({
  initialValue,
  plugins,
  onComplete
}) => {
  const [step, setStep] = useState(0);
  const [basic, setBasic] = useState<FlowBasicInfo>({ ...DEFAULT_BASIC, ...initialValue?.basic });
  const [initiators, setInitiators] = useState<FlowInitiator[]>(initialValue?.initiators ?? []);
  const [storageMode, setStorageMode] = useState<StorageMode>(initialValue?.storageMode ?? "json");
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
  const [flowDefinition, setFlowDefinition] = useState<FlowDefinition>(initialValue?.flowDefinition ?? EMPTY_FLOW);

  const [initialFlow] = useState<FlowDefinition>(() => initialValue?.flowDefinition ?? EMPTY_FLOW);

  // One projection feeds every consumer: the backend form definition, the
  // flow editor's field metadata (detail tables included), and the step gate.
  const projection = useMemo(() => formSchema ? projectFormSchema(formSchema) : null, [formSchema]);
  const formDefinition = useMemo(() => projection?.definition ?? { fields: [] }, [projection]);
  const flowPlugins = useMemo<EditorPlugins>(
    () => { return { ...plugins, formFields: projection?.formFields ?? [] }; },
    [plugins, projection]
  );
  const flowErrors = useMemo(() => validateFlowDefinition(flowDefinition), [flowDefinition]);

  const handleSchemaChange = useCallback((schema: FormSchema) => setFormSchema(schema), []);
  const handleFlowChange = useCallback((definition: FlowDefinition) => setFlowDefinition(definition), []);
  const handleBasicChange = useCallback(
    (patch: Partial<FlowBasicInfo>) => setBasic(prev => { return { ...prev, ...patch }; }),
    []
  );

  const basicValid = basic.code.trim() !== ""
    && basic.name.trim() !== ""
    && basic.instanceTitleTemplate.trim() !== ""
    && (basic.bindingMode !== "business" || (!!basic.businessTable && !!basic.businessPkField))
    && initiators.length > 0;
  const stepValid = [basicValid, projection === null || projection.valid, flowErrors.length === 0, true];
  const currentStepValid = stepValid[step] ?? false;

  const payload: FlowDesignPayload = {
    basic,
    initiators,
    storageMode,
    formDefinition,
    flowDefinition
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0
    }}
    >
      <div style={{ padding: "16px 48px", borderBottom: "1px solid var(--vef-color-border-secondary)" }}>
        <Steps current={step} items={STEP_ITEMS} size="small" />
      </div>

      <div style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column"
      }}
      >
        <div style={stepPaneStyle(step === 0, true)}>
          <BasicInfoStep
            basic={basic}
            initiators={initiators}
            pickers={plugins?.pickers}
            onBasicChange={handleBasicChange}
            onInitiatorsChange={setInitiators}
          />
        </div>

        <div style={stepPaneStyle(step === 1, false)}>
          <FormDesignStep
            issues={projection?.issues ?? []}
            storageMode={storageMode}
            onSchemaChange={handleSchemaChange}
            onStorageModeChange={setStorageMode}
          />
        </div>

        <div style={stepPaneStyle(step === 2, false)}>
          <FlowDesignStep
            errors={flowErrors}
            plugins={flowPlugins}
            value={initialFlow}
            onChange={handleFlowChange}
          />
        </div>

        <div style={stepPaneStyle(step === 3, true)}>
          <ReviewStep payload={payload} />
        </div>
      </div>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "12px 48px",
        borderTop: "1px solid var(--vef-color-border-secondary)"
      }}
      >
        <Button disabled={step === 0} onClick={() => setStep(prev => prev - 1)}>上一步</Button>

        {step < STEP_ITEMS.length - 1
          ? (
              <Button
                disabled={!currentStepValid}
                type="primary"
                onClick={() => setStep(prev => prev + 1)}
              >
                下一步
              </Button>
            )
          : <Button type="primary" onClick={() => onComplete(payload)}>完成</Button>}
      </div>
    </div>
  );
};
