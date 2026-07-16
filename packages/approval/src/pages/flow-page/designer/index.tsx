import type { FlowDefinition } from "@vef-framework-react/approval-flow-editor";
import type { FormSchema } from "@vef-framework-react/form-editor";

import type { Flow, InitiatorParams } from "../../../types";
import type { FlowDraft, FlowDraftBasic } from "./types";

import { validateFlowDefinition } from "@vef-framework-react/approval-flow-editor";
import { projectFormSchema, validateApprovalSchema } from "@vef-framework-react/approval-form-bridge";
import { Button, Drawer, Flex, showSuccessMessage, Spin, Steps } from "@vef-framework-react/components";
import { useMutation, useQuery } from "@vef-framework-react/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useCategoryApi, useFlowApi } from "../../../api";
import { toEditorPlugins, useApprovalPlugins } from "../../../plugins";
import { buildCategoryTreeOptions } from "../../category-page/form";
import { BasicStep } from "./basic-step";
import { FlowStep } from "./flow-step";
import { FormStep } from "./form-step";
import { ReviewStep } from "./review-step";
import { createEmptyDraft, EMPTY_FLOW_DEFINITION, isBindingValid } from "./types";

const STEP_ITEMS = [
  { title: "流程设置" },
  { title: "表单设计" },
  { title: "流程设计" },
  { title: "审阅提交" }
];

export interface FlowDesignerDrawerProps {
  open: boolean;
  /**
   * The flow being redesigned; omit to create a new one. The published
   * version's definition seeds the editors.
   */
  flow?: Flow;
  /**
   * The tenant new flows are created under.
   */
  tenantId: string;
  onClose: () => void;
}

/**
 * The designer's inner body, mounted fresh per drawer opening (keyed by the
 * parent) so editor seeds and step state never leak between sessions.
 */
function DesignerBody({
  flow,
  tenantId,
  onClose
}: Omit<FlowDesignerDrawerProps, "open">) {
  const flowApi = useFlowApi();
  const categoryApi = useCategoryApi();
  const plugins = useApprovalPlugins();

  const isEditing = flow !== undefined;

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FlowDraft | null>(() => isEditing ? null : createEmptyDraft(tenantId));
  const [versionDescription, setVersionDescription] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { data: categories } = useQuery({ queryFn: categoryApi.findTree, queryKey: [categoryApi.findTree.key, {}] });
  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories ?? []), [categories]);

  // Editing seeds: the flow's published definition and its initiator rules.
  const { data: graph } = useQuery({
    queryFn: flowApi.getGraph,
    queryKey: [flowApi.getGraph.key, { flowId: flow?.id ?? "" }],
    enabled: isEditing
  });
  const { data: initiatorRows } = useQuery({
    queryFn: flowApi.findInitiators,
    queryKey: [flowApi.findInitiators.key, { flowId: flow?.id ?? "" }],
    enabled: isEditing
  });

  useEffect(() => {
    if (!isEditing || draft !== null || graph === undefined || initiatorRows === undefined) {
      return;
    }

    const { version } = graph;

    setDraft({
      flowId: flow.id,
      basic: {
        tenantId: flow.tenantId,
        code: flow.code,
        name: flow.name,
        categoryId: flow.categoryId,
        icon: flow.icon ?? undefined,
        description: flow.description ?? undefined,
        labels: flow.labels ?? {},
        bindingMode: flow.bindingMode,
        businessBinding: flow.businessBinding ?? undefined,
        adminUserIds: flow.adminUserIds,
        isAllInitiationAllowed: flow.isAllInitiationAllowed,
        instanceTitleTemplate: flow.instanceTitleTemplate
      },
      initiators: initiatorRows.map<InitiatorParams>(row => {
        return { kind: row.kind, ids: row.ids };
      }),
      storageMode: version?.storageMode ?? "json",
      formSchema: version?.formSchema ?? null,
      flowDefinition: version?.flowSchema ?? EMPTY_FLOW_DEFINITION
    });
  }, [isEditing, draft, graph, initiatorRows, flow]);

  // Every chain step invalidates the flow list, so the table behind the
  // drawer refreshes on its own once the chain lands.
  const chainMeta = {
    shouldShowSuccessFeedback: false,
    invalidates: [[flowApi.findFlows.key] as const, [flowApi.findVersions.key] as const]
  };
  const create = useMutation({ mutationFn: flowApi.create, meta: chainMeta });
  const update = useMutation({ mutationFn: flowApi.update, meta: chainMeta });
  const deploy = useMutation({ mutationFn: flowApi.deploy, meta: chainMeta });
  const publishVersion = useMutation({ mutationFn: flowApi.publishVersion, meta: chainMeta });

  // Client-side pre-checks of the server save gates, driving the step gates.
  const projection = useMemo(
    () => draft?.formSchema ? projectFormSchema(draft.formSchema) : null,
    [draft?.formSchema]
  );
  const formGate = useMemo(
    () => draft?.formSchema ? validateApprovalSchema(draft.formSchema, plugins.registries) : null,
    [draft?.formSchema, plugins.registries]
  );
  const flowErrors = useMemo(
    () => draft ? validateFlowDefinition(draft.flowDefinition, projection?.formFields ?? []) : [],
    [draft, projection]
  );
  const editorPlugins = useMemo(
    () => toEditorPlugins(plugins, projection?.formFields ?? []),
    [plugins, projection]
  );

  const handleBasicChange = useCallback((patch: Partial<FlowDraftBasic>) => {
    setDraft(prev => prev ? { ...prev, basic: { ...prev.basic, ...patch } } : prev);
  }, []);
  const handleInitiatorsChange = useCallback((initiators: InitiatorParams[]) => {
    setDraft(prev => prev ? { ...prev, initiators } : prev);
  }, []);
  const handleSchemaChange = useCallback((formSchema: FormSchema) => {
    setDraft(prev => prev ? { ...prev, formSchema } : prev);
  }, []);
  const handleDefinitionChange = useCallback((flowDefinition: FlowDefinition) => {
    setDraft(prev => prev ? { ...prev, flowDefinition } : prev);
  }, []);

  if (draft === null) {
    return (
      <Flex align="center" justify="center" style={{ height: "100%" }}>
        <Spin />
      </Flex>
    );
  }

  // Alias the narrowed draft so the submit closure below keeps the non-null
  // type (state variables lose narrowing inside async closures).
  const currentDraft = draft;
  const { basic } = currentDraft;
  const basicValid = basic.code.trim() !== ""
    && basic.name.trim() !== ""
    && basic.categoryId !== ""
    && basic.instanceTitleTemplate.trim() !== ""
    && (basic.bindingMode !== "business" || isBindingValid(basic.businessBinding))
    && (basic.isAllInitiationAllowed || draft.initiators.some(rule => rule.ids.length > 0));
  const stepValid = [
    basicValid,
    formGate === null || formGate.valid,
    flowErrors.length === 0,
    true
  ];
  const currentStepValid = stepValid[step] ?? false;

  async function submit(): Promise<void> {
    setSubmitting(true);

    try {
      // Standalone flows must not carry a binding (the backend rejects an
      // unexpected one); the in-progress binding state is only dropped at
      // submit so switching modes never loses input.
      const businessBinding = basic.bindingMode === "business" ? basic.businessBinding : undefined;
      const initiators = currentDraft.initiators.filter(rule => rule.ids.length > 0);

      let flowId: string;

      if (currentDraft.flowId === undefined) {
        const created = await create.mutateAsync({
          tenantId: basic.tenantId,
          code: basic.code,
          name: basic.name,
          categoryId: basic.categoryId,
          icon: basic.icon,
          description: basic.description,
          labels: basic.labels,
          bindingMode: basic.bindingMode,
          businessBinding,
          adminUserIds: basic.adminUserIds,
          isAllInitiationAllowed: basic.isAllInitiationAllowed,
          instanceTitleTemplate: basic.instanceTitleTemplate,
          initiators
        });
        flowId = created.id;
      } else {
        const updated = await update.mutateAsync({
          flowId: currentDraft.flowId,
          name: basic.name,
          icon: basic.icon,
          description: basic.description,
          labels: basic.labels,
          bindingMode: basic.bindingMode,
          businessBinding,
          adminUserIds: basic.adminUserIds,
          isAllInitiationAllowed: basic.isAllInitiationAllowed,
          instanceTitleTemplate: basic.instanceTitleTemplate,
          initiators
        });
        flowId = updated.id;
      }

      const version = await deploy.mutateAsync({
        flowId,
        description: versionDescription.trim() || undefined,
        storageMode: currentDraft.storageMode,
        flowDefinition: currentDraft.flowDefinition,
        formSchema: currentDraft.formSchema ?? undefined
      });

      if (publishNow) {
        await publishVersion.mutateAsync({ versionId: version.id });
      }

      showSuccessMessage(publishNow ? "流程已部署并发布" : "流程已部署为草稿版本");
      onClose();
    } catch {
      /* surfaced by the http client */
    } finally {
      setSubmitting(false);
    }
  }

  const stepPanes = [
    <BasicStep
      key="basic"
      basic={basic}
      categoryOptions={categoryOptions}
      initiators={draft.initiators}
      isEditing={isEditing}
      onBasicChange={handleBasicChange}
      onInitiatorsChange={handleInitiatorsChange}
    />,
    <FormStep
      key="form"
      initialSchema={draft.formSchema ?? undefined}
      issues={formGate?.issues ?? []}
      registries={plugins.registries}
      storageMode={draft.storageMode}
      onSchemaChange={handleSchemaChange}
      onStorageModeChange={storageMode => setDraft(prev => prev ? { ...prev, storageMode } : prev)}
    />,
    <FlowStep
      key="flow"
      errors={flowErrors}
      plugins={editorPlugins}
      value={draft.flowDefinition}
      onChange={handleDefinitionChange}
    />,
    <ReviewStep
      key="review"
      draft={draft}
      fields={projection?.fields ?? []}
      publishNow={publishNow}
      versionDescription={versionDescription}
      onPublishNowChange={setPublishNow}
      onVersionDescriptionChange={setVersionDescription}
    />
  ];

  return (
    <Flex style={{ height: "100%", flexDirection: "column" }}>
      <div style={{ padding: "12px 32px", borderBottom: "1px solid var(--vef-color-border-secondary)" }}>
        <Steps current={step} items={STEP_ITEMS} size="small" style={{ maxWidth: 720, marginInline: "auto" }} />
      </div>

      <div style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column"
      }}
      >
        {stepPanes.map((pane, index) => {
          // Every pane stays mounted so editor state survives step switches;
          // display toggles visibility only.
          const active = index === step;
          const scrollable = index === 0 || index === 3;

          return (
            <div
              key={index}
              style={{
                display: active ? "flex" : "none",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflow: scrollable ? "auto" : "hidden",
                padding: scrollable ? "24px 32px" : "16px 24px"
              }}
            >
              {pane}
            </div>
          );
        })}
      </div>

      <Flex
        align="center"
        justify="space-between"
        style={{ padding: "12px 32px", borderTop: "1px solid var(--vef-color-border-secondary)" }}
      >
        <Button disabled={step === 0 || submitting} onClick={() => setStep(prev => prev - 1)}>
          上一步
        </Button>

        {step < STEP_ITEMS.length - 1
          ? (
              <Button disabled={!currentStepValid} type="primary" onClick={() => setStep(prev => prev + 1)}>
                下一步
              </Button>
            )
          : (
              <Button loading={submitting} type="primary" onClick={() => void submit()}>
                {publishNow ? "部署并发布" : "部署为草稿"}
              </Button>
            )}
      </Flex>
    </Flex>
  );
}

/**
 * The full-screen flow designer: settings → form → graph → review, submitted
 * as one create/update → deploy → optional publish chain. Remounts per
 * opening so editor seeds never leak between sessions.
 */
export function FlowDesignerDrawer({
  open,
  flow,
  tenantId,
  onClose
}: FlowDesignerDrawerProps) {
  return (
    <Drawer
      destroyOnHidden
      open={open}
      placement="right"
      size="100%"
      styles={{ body: { padding: 0 } }}
      title={flow ? `流程设计 · ${flow.name}` : "新建流程"}
      onClose={onClose}
    >
      {open && <DesignerBody key={flow?.id ?? "create"} flow={flow} tenantId={tenantId} onClose={onClose} />}
    </Drawer>
  );
}
