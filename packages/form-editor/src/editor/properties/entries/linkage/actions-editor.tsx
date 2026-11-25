import type { DragEndEvent } from "@vef-framework-react/core";
import type { FC } from "react";

import type { WritableTargetField } from "../../../../engine/linkage";
import type { ValidationIssue, ValidationSeverity } from "../../../../engine/validation";
import type {
  FieldLinkageAction,
  FormDataSource,
  FormField,
  FormVariable,
  KeyedFormField,
  LinkageActionType,
  LinkageTriggerKind
} from "../../../../types";
import type { ReferenceScope } from "../../reference-scope";
import type { ModalEditableAction } from "./action-modal";
import type { ActionSummaryContext } from "./action-summary";
import type { SourceFieldOption } from "./options";

import { Button } from "@vef-framework-react/components";
import { DragDropProvider, moveDragItem, RestrictToVerticalAxis } from "@vef-framework-react/core";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  findBrokenStepReferencesAfterReorder,
  findDependentStepsAfter,
  isEffectAction,
  renameStepOutputInRule,
  resolvePriorStepSchemas
} from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { useContextSources } from "../../../context-sources";
import { useDataSourceApis } from "../../../data-source-apis";
import { usePreviewRuntime } from "../../../preview-runtime-context";
import { confirmDialog } from "../../../toolbar/notify";
import { ActionEditor } from "./action-editor";
import { ActionDraftModal, isModalEditableAction } from "./action-modal";
import { createActionFor } from "./mutators";
import { actionOptionsFor } from "./options";
import { parseIssueActionIndex } from "./rule-diagnostics";
import { actionsListCss, addInlineButtonCss, sectionCss, sectionLabelCss } from "./styles";

const EMPTY_DATA_SOURCES: readonly FormDataSource[] = [];
const EMPTY_VARIABLES: readonly FormVariable[] = [];
const EMPTY_TARGETS: readonly WritableTargetField[] = [];
const EMPTY_SCOPE_FIELDS: ReadonlyMap<string, KeyedFormField> = new Map();
const EMPTY_ISSUES: readonly ValidationIssue[] = [];

interface ModalSession {
  key: number;
  actionIndex: number;
  action: ModalEditableAction;
  open: boolean;
}

export interface ActionFocusSignal {
  index: number;
  nonce: number;
}

function stableActionId(action: FieldLinkageAction, index: number): string {
  return action.id ?? `action-idx-${index}`;
}

/**
 * Pure reorder helper for an action sequence from a sortable drag event.
 * Exported so drag reordering can be unit-tested with a fabricated DragEndEvent.
 */
export function reorderActions(
  actions: readonly FieldLinkageAction[],
  event: DragEndEvent
): FieldLinkageAction[] | null {
  const ids = actions.map((action, index) => stableActionId(action, index));
  const nextIds = moveDragItem(ids, event);

  if (nextIds === ids) {
    return null;
  }

  const byId = new Map(ids.map((id, index) => [id, actions[index]] as const));

  return nextIds
    .map(id => byId.get(id))
    .filter((item): item is FieldLinkageAction => item !== undefined);
}

function unsupportedReasonFor(
  action: FieldLinkageAction,
  hasRequest: boolean | undefined,
  hasNavigate: boolean | undefined
): string | null {
  if (action.type === "api_call" && hasRequest === false) {
    return "当前宿主未接入接口调用服务，运行时将跳过此步骤；已有配置仍可编辑。";
  }

  if (action.type === "navigate" && hasNavigate === false) {
    return "当前宿主未接入页面跳转服务，运行时将跳过此步骤；已有配置仍可编辑。";
  }

  return null;
}

export interface ActionsEditorProps {
  actions: FieldLinkageAction[];
  /**
   * The rule's trigger kind — selects the action palette (state actions are
   * offered only under a `condition` trigger).
   */
  triggerKind: LinkageTriggerKind;
  isTargetKeyed: boolean;
  /**
   * Whether this scope permits state actions at all (field scope yes, form
   * scope no — the form has no self field whose state could be derived).
   */
  allowStateActions: boolean;
  /**
   * Whether the rule's target is a container — narrows the state palette to
   * the actions a container supports (`show` / `hide` / `enable` / `disable`).
   */
  isContainerTarget?: boolean;
  /**
   * Same-scope keyed fields for reference pickers inside action payloads.
   */
  sourceOptions: SourceFieldOption[];
  /**
   * Form-global declared variables for reference pickers inside action payloads.
   */
  variables?: readonly FormVariable[];
  /**
   * Writable keyed fields offered as `set_fields` targets.
   */
  targetOptions: SourceFieldOption[];
  writableTargets?: readonly WritableTargetField[];
  scopeFieldsByKey?: ReadonlyMap<string, KeyedFormField>;
  dataSources?: readonly FormDataSource[];
  /**
   * Form-global data sources offered as a `refresh_data_source` target.
   */
  dataSourceOptions: SourceFieldOption[];
  /**
   * Owning field when editing a leaf field rule (drives typed literal input on
   * `assign`).
   */
  ownerField?: FormField;
  /**
   * Rule-scoped validation issues, used to mark steps carrying errors/warnings.
   */
  ruleIssues?: readonly ValidationIssue[];
  /**
   * One-shot focus signal (from footer diagnostic jump or clicking a line in
   * `RuleDiagnostics`) that expands, scrolls to, and briefly highlights a step.
   */
  focusSignal?: ActionFocusSignal | null;
  onChange: (next: FieldLinkageAction[]) => void;
}

/**
 * The THEN half of a rule: an ordered, drag-sortable, collapsible sequence of
 * actions. Single-action rules default expanded; multi-step sequences default
 * collapsed so the whole sequence stays visible on one screen, with a wide
 * `DraftModal` for complex steps (`api_call`, `select_record`, `set_fields`).
 */
export const ActionsEditor: FC<ActionsEditorProps> = ({
  actions,
  allowStateActions,
  dataSourceOptions,
  dataSources = EMPTY_DATA_SOURCES,
  focusSignal,
  isContainerTarget = false,
  isTargetKeyed,
  onChange,
  ownerField,
  ruleIssues = EMPTY_ISSUES,
  scopeFieldsByKey = EMPTY_SCOPE_FIELDS,
  sourceOptions,
  targetOptions,
  triggerKind,
  variables = EMPTY_VARIABLES,
  writableTargets = EMPTY_TARGETS
}) => {
  const { serviceCapabilities } = usePreviewRuntime();
  const hasRequest = serviceCapabilities?.hasRequest;
  const hasNavigate = serviceCapabilities?.hasNavigate;
  const apis = useDataSourceApis();
  const contextSources = useContextSources();

  // Single-step rules open expanded for direct editing; multi-step sequences
  // open collapsed so the full pipeline fits on one screen.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => {
    if (actions.length === 1 && actions[0] !== undefined) {
      return new Set([stableActionId(actions[0], 0)]);
    }

    return new Set();
  });
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [modalSession, setModalSession] = useState<ModalSession | null>(null);
  const stepRefs = useRef(new Map<string, HTMLDivElement>());

  const availableActions = useMemo(
    () => actionOptionsFor({
      triggerKind,
      isTargetKeyed,
      allowStateActions,
      isContainerTarget,
      hasRequest,
      hasNavigate
    }),
    [triggerKind, isTargetKeyed, allowStateActions, isContainerTarget, hasRequest, hasNavigate]
  );

  // Per-step highest issue severity so collapsed steps surface errors/warnings.
  const severityByIndex = useMemo(() => {
    const map = new Map<number, ValidationSeverity>();

    for (const issue of ruleIssues) {
      const idx = parseIssueActionIndex(issue.path);

      if (idx === undefined) {
        continue;
      }

      const prev = map.get(idx);

      if (prev !== "error") {
        map.set(idx, issue.severity);
      }
    }

    return map;
  }, [ruleIssues]);

  const summaryContext = useMemo<ActionSummaryContext>(() => {
    const fieldLabels = new Map<string, string>();

    for (const [key, field] of scopeFieldsByKey) {
      fieldLabels.set(key, field.label || key);
    }

    if (fieldLabels.size === 0) {
      for (const option of sourceOptions) {
        fieldLabels.set(option.value, option.label.split(" · ", 1)[0] ?? option.value);
      }
    }

    const dataSourceLabels = new Map<string, string>();

    for (const option of dataSourceOptions) {
      dataSourceLabels.set(option.value, option.label);
    }

    return {
      apis,
      fieldLabels,
      dataSourceLabels
    };
  }, [apis, scopeFieldsByKey, sourceOptions, dataSourceOptions]);

  // Expand, scroll into view, and briefly highlight the target step on jump.
  useEffect(() => {
    if (focusSignal === undefined || focusSignal === null) {
      return;
    }

    const target = actions[focusSignal.index];

    if (target === undefined) {
      return;
    }

    const id = stableActionId(target, focusSignal.index);

    setExpandedIds(prev => {
      if (prev.has(id)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setHighlightedId(id);

    const frame = globalThis.requestAnimationFrame?.(() => {
      stepRefs.current.get(id)?.scrollIntoView?.({ block: "nearest" });
    });
    const timer = setTimeout(() => {
      setHighlightedId(current => current === id ? null : current);
    }, 1800);

    return () => {
      if (frame !== undefined) {
        globalThis.cancelAnimationFrame?.(frame);
      }

      clearTimeout(timer);
    };
  }, [focusSignal, actions]);

  const toggleExpand = (id: string): void => {
    setExpandedIds(prev => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const updateAt = (index: number, next: FieldLinkageAction): void => {
    onChange(actions.map((action, current) => current === index ? next : action));
  };

  const commitRemove = (index: number): void => {
    onChange(actions.filter((_, current) => current !== index));
  };

  const removeAt = (index: number): void => {
    const dependents = findDependentStepsAfter(actions, index);

    if (dependents.length === 0) {
      commitRemove(index);
      return;
    }

    const target = actions[index];
    const outputName = target !== undefined && (target.type === "api_call" || target.type === "select_record")
      ? target.output
      : undefined;
    const stepList = dependents.map(dep => `步骤 ${dep.index + 1}`).join("、");

    confirmDialog(
      `步骤 ${index + 1} 的结果正被后续步骤引用，仍要删除吗？`,
      `${stepList} 引用了${outputName ? `结果「${outputName}」` : "该步骤的结果"}，删除后这些引用将失效。`,
      {
        okText: "仍然删除",
        cancelText: "取消",
        onOk: () => commitRemove(index)
      }
    );
  };

  const changeTypeAt = (index: number, nextType: LinkageActionType): void => {
    const current = actions[index];

    if (current === undefined) {
      return;
    }

    const applyTypeSwitch = (): void => {
      const others = actions.filter((_, idx) => idx !== index);
      const seeded = createActionFor(nextType, others);
      const nextAction = current.id === undefined ? seeded : { ...seeded, id: current.id };

      updateAt(index, nextAction);
    };

    const dependents = findDependentStepsAfter(actions, index);

    if (dependents.length === 0) {
      applyTypeSwitch();
      return;
    }

    const stepList = dependents.map(dep => `步骤 ${dep.index + 1}`).join("、");

    confirmDialog(
      `步骤 ${index + 1} 的结果正被后续步骤引用，仍要更改类型吗？`,
      `${stepList} 依赖该步骤的输出结果，更改动作类型后这些引用将失效。`,
      {
        okText: "仍然更改",
        cancelText: "取消",
        onOk: applyTypeSwitch
      }
    );
  };

  const addAction = (): void => {
    const seed = availableActions[0]?.value;

    if (!seed) {
      return;
    }

    const created = createActionFor(seed, actions);
    const nextActions = [...actions, created];
    const createdId = stableActionId(created, nextActions.length - 1);

    setExpandedIds(prev => {
      const next = new Set(prev);
      next.add(createdId);
      return next;
    });
    onChange(nextActions);
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const nextActions = reorderActions(actions, event);

    if (nextActions === null) {
      return;
    }

    const broken = findBrokenStepReferencesAfterReorder(nextActions);

    if (broken.length === 0) {
      onChange(nextActions);
      return;
    }

    const detail = broken
      .map(item => `步骤 ${item.consumerIndex + 1} 引用了结果「${item.stepName}」，但产出该结果的步骤现在排在步骤 ${item.producerIndex + 1}`)
      .join("；");

    confirmDialog(
      "调整顺序后部分步骤引用将失效，仍要移动吗？",
      `${detail}。`,
      {
        okText: "仍然移动",
        cancelText: "取消",
        onOk: () => onChange(nextActions)
      }
    );
  };

  const openModalFor = (index: number): void => {
    const target = actions[index];

    if (target === undefined || !isModalEditableAction(target)) {
      return;
    }

    setModalSession(prev => {
      return {
        key: (prev?.key ?? 0) + 1,
        actionIndex: index,
        action: target,
        open: true
      };
    });
  };

  const handleModalSubmit = (index: number, nextAction: ModalEditableAction): void => {
    const previous = actions[index];

    if (previous === undefined) {
      return;
    }

    // Apply all payload changes first, then run output-rename propagation when
    // the output name changed so downstream `$steps.<old>` links stay in sync
    // inside the same single undo step.
    const replaced = actions.map((item, current) => current === index ? nextAction : item);
    const prevOutput = previous.type === "api_call" || previous.type === "select_record" ? previous.output : undefined;
    const nextOutput = nextAction.type === "api_call" || nextAction.type === "select_record" ? nextAction.output : undefined;

    if (prevOutput !== undefined && nextOutput !== undefined && prevOutput !== nextOutput) {
      const withOldOutput = actions.map((item, current) => {
        if (current !== index) {
          return item;
        }

        return nextAction.type === "api_call"
          ? { ...nextAction, output: prevOutput }
          : { ...nextAction, output: prevOutput };
      });

      onChange(renameStepOutputInRule(withOldOutput, index, nextOutput));
      return;
    }

    onChange(replaced);
  };

  const modalPriorSteps = modalSession === null
    ? []
    : resolvePriorStepSchemas(actions, modalSession.actionIndex, apis);
  const modalReferenceScope: ReferenceScope = {
    fieldOptions: sourceOptions,
    variables,
    contextSources,
    allowSteps: true,
    priorSteps: modalPriorSteps
  };

  return (
    <div css={sectionCss}>
      <span css={sectionLabelCss}>THEN</span>

      <DragDropProvider modifiers={[RestrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        <div css={actionsListCss}>
          {actions.map((action, index) => {
            const id = stableActionId(action, index);
            const allowSteps = isEffectAction(action);
            const priorSteps = allowSteps ? resolvePriorStepSchemas(actions, index, apis) : [];
            const referenceScope: ReferenceScope = {
              fieldOptions: sourceOptions,
              variables,
              contextSources,
              allowSteps,
              priorSteps
            };

            return (
              <ActionEditor
                key={id}
                action={action}
                actionIndex={index}
                allActions={actions}
                availableActions={availableActions}
                canEditInModal={isModalEditableAction(action)}
                canRemove={actions.length > 1}
                canReorder={actions.length > 1}
                dataSourceOptions={dataSourceOptions}
                dataSources={dataSources}
                expanded={expandedIds.has(id)}
                highlighted={highlightedId === id}
                issueSeverity={severityByIndex.get(index)}
                ownerField={ownerField}
                priorSteps={priorSteps}
                referenceScope={referenceScope}
                scopeFieldsByKey={scopeFieldsByKey}
                sortableId={id}
                summaryContext={summaryContext}
                targetOptions={targetOptions}
                unsupportedReason={unsupportedReasonFor(action, hasRequest, hasNavigate)}
                writableTargets={writableTargets}
                stepRef={node => {
                  if (node === null) {
                    stepRefs.current.delete(id);
                  } else {
                    stepRefs.current.set(id, node);
                  }
                }}
                onChange={next => updateAt(index, next)}
                onChangeType={nextType => changeTypeAt(index, nextType)}
                onOpenModal={() => openModalFor(index)}
                onRemove={() => removeAt(index)}
                onRenameOutput={nextOutput => onChange(renameStepOutputInRule(actions, index, nextOutput))}
                onToggleExpand={() => toggleExpand(id)}
              />
            );
          })}
        </div>
      </DragDropProvider>

      <Button
        css={addInlineButtonCss}
        disabled={availableActions.length === 0}
        icon={<EditorIcon name="plus" />}
        size="small"
        type="dashed"
        onClick={addAction}
      >
        新增动作
      </Button>

      {modalSession === null
        ? null
        : (
            <ActionDraftModal
              key={modalSession.key}
              action={modalSession.action}
              actionIndex={modalSession.actionIndex}
              allActions={actions}
              dataSources={dataSources}
              open={modalSession.open}
              priorSteps={modalPriorSteps}
              referenceScope={modalReferenceScope}
              scopeFieldsByKey={scopeFieldsByKey}
              targetOptions={targetOptions}
              writableTargets={writableTargets}
              onAfterClose={() => setModalSession(current => current?.open ? current : null)}
              onClose={() => setModalSession(current => current && { ...current, open: false })}
              onSubmit={next => handleModalSubmit(modalSession.actionIndex, next)}
            />
          )}
    </div>
  );
};
