import type { DragDropEventHandlers } from "@vef-framework-react/core";
import type { FC } from "react";

import type { ValidationIssue, ValidationSeverity } from "../../../../engine/validation";
import type { FieldLinkageAction, LinkageActionType, LinkageTriggerKind } from "../../../../types";
import type { ModalEditableAction } from "./action-modal";
import type { LinkageScope } from "./use-linkage-editor-model";

import { Button } from "@vef-framework-react/components";
import { DragDropProvider, RestrictToVerticalAxis } from "@vef-framework-react/core";
import { useLatest } from "@vef-framework-react/hooks";
import { useEffect, useMemo, useState } from "react";

import { createId } from "../../../../engine/ids";
import {
  findBrokenStepReferences,
  findDependentStepsAfter,
  getStepOutputName,
  isEffectAction,
  renameStepOutputInRule,
  resolvePriorStepSchemas,
  writeActionOutput
} from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { useDataSourceApis } from "../../../data-source-apis";
import { parseLinkageIssuePath } from "../../../linkage-issue-path";
import { usePreviewRuntime } from "../../../preview-runtime-context";
import { confirmDialog } from "../../../toolbar/notify";
import { reorderRows } from "../../sortable-rows";
import { ActionEditor } from "./action-editor";
import { ActionDraftModal } from "./action-modal";
import { createActionFor } from "./mutators";
import { actionOptionsFor } from "./options";
import { actionsListCss, addInlineButtonCss, sectionCss, sectionLabelCss } from "./styles";

type DragEndHandler = DragDropEventHandlers["onDragEnd"];

interface ModalSession {
  key: number;
  actionIndex: number;
  action: ModalEditableAction;
  /**
   * `false` while the modal plays its close transition.
   */
  open: boolean;
}

/**
 * A step's identity among its rule's. Actions authored here carry an id; one
 * from a hand-written schema may not, and goes by its position.
 */
function actionKey(action: FieldLinkageAction, index: number): string {
  return action.id ?? `action-${index}`;
}

function actionKeys(actions: readonly FieldLinkageAction[]): string[] {
  return actions.map((action, index) => actionKey(action, index));
}

/**
 * The action under an id of its own, which a moved step needs to keep its
 * identity: one that goes by its position would pass it to whichever step
 * takes its place.
 */
function identified(action: FieldLinkageAction): FieldLinkageAction {
  return action.id === undefined ? { ...action, id: createId("Action") } : action;
}

function unsupportedReasonFor(
  action: FieldLinkageAction,
  hasRequest: boolean | undefined,
  hasNavigate: boolean | undefined
): string | null {
  if (action.type === "api_call" && hasRequest === false) {
    return "当前宿主未接入接口调用，执行到此步骤会失败；已有配置仍可编辑。";
  }

  if (action.type === "navigate" && hasNavigate === false) {
    return "当前宿主未接入页面跳转，执行到此步骤会失败；已有配置仍可编辑。";
  }

  return null;
}

/**
 * The worst issue of each step, so a collapsed one still shows it has any.
 */
function worstSeverities(issues: readonly ValidationIssue[]): ReadonlyMap<number, ValidationSeverity> {
  const severities = new Map<number, ValidationSeverity>();

  for (const issue of issues) {
    const index = parseLinkageIssuePath(issue.path)?.actionIndex;

    if (index !== undefined && severities.get(index) !== "error") {
      severities.set(index, issue.severity);
    }
  }

  return severities;
}

function listSteps(indexes: readonly number[]): string {
  return indexes.map(index => `步骤 ${index + 1}`).join("、");
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
  isContainerTarget: boolean;
  scope: LinkageScope;
  /**
   * The owning block's data-binding key (when keyed), which `assign` writes.
   */
  selfKey?: string;
  /**
   * The rule's validation issues.
   */
  issues: readonly ValidationIssue[];
  /**
   * The step to expand and show; a new object per request.
   */
  focus: { actionIndex?: number } | null;
  onChange: (next: FieldLinkageAction[]) => void;
}

/**
 * The THEN half of a rule: an ordered sequence of collapsible steps. A lone
 * step opens expanded and a longer sequence collapsed, so the whole of it stays
 * on one screen; the ones with much to configure also open in a wide modal.
 */
export const ActionsEditor: FC<ActionsEditorProps> = ({
  actions,
  allowStateActions,
  focus,
  isContainerTarget,
  issues,
  isTargetKeyed,
  onChange,
  scope,
  selfKey,
  triggerKind
}) => {
  const { serviceCapabilities } = usePreviewRuntime();
  const hasRequest = serviceCapabilities?.hasRequest;
  const hasNavigate = serviceCapabilities?.hasNavigate;
  const apis = useDataSourceApis();
  const actionsRef = useLatest(actions);

  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
    () => new Set(actions.length === 1 ? actionKeys(actions) : [])
  );
  const [attention, setAttention] = useState<{ key: string } | null>(null);
  const [modalSession, setModalSession] = useState<ModalSession | null>(null);

  // The order a drag left, shown while the reader decides on the references it
  // breaks. The drag has moved the rows' elements by then, so declining it puts
  // them back only if this order was rendered first.
  const [proposed, setProposed] = useState<FieldLinkageAction[] | null>(null);
  const shown = proposed ?? actions;

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

  // Only an effect step reads the results before it; a state action is derived
  // outside any sequence.
  const priorStepsByIndex = useMemo(
    () => shown.map((action, index) => isEffectAction(action) ? resolvePriorStepSchemas(shown, index, apis) : undefined),
    [shown, apis]
  );

  const severities = useMemo(() => worstSeverities(issues), [issues]);

  // Resolved once per request, to the step that stood there: later edits must
  // not move or repeat the jump.
  useEffect(() => {
    const index = focus?.actionIndex;
    const target = index === undefined ? undefined : actionsRef.current[index];

    if (index !== undefined && target !== undefined) {
      const key = actionKey(target, index);

      setExpandedKeys(previous => new Set(previous).add(key));
      setAttention({ key });
    }
  }, [focus, actionsRef]);

  const toggleExpand = (key: string): void => {
    setExpandedKeys(previous => {
      const next = new Set(previous);

      if (!next.delete(key)) {
        next.add(key);
      }

      return next;
    });
  };

  const updateAt = (index: number, next: FieldLinkageAction): void => {
    onChange(actions.with(index, next));
  };

  const removeAt = (index: number): void => {
    const commit = (): void => onChange(actions.toSpliced(index, 1));
    const dependents = findDependentStepsAfter(actions, index);

    if (dependents.length === 0) {
      commit();
      return;
    }

    confirmDialog(
      `步骤 ${index + 1} 的结果正被后续步骤引用，仍要删除吗？`,
      `${listSteps(dependents)} 引用了该步骤的结果，删除后这些引用将失效。`,
      {
        okText: "仍然删除",
        cancelText: "取消",
        onOk: commit
      }
    );
  };

  const changeTypeAt = (index: number, nextType: LinkageActionType): void => {
    const commit = (): void => {
      const created = createActionFor(nextType, actions, index);

      updateAt(index, { ...created, id: actions[index]?.id ?? created.id });
    };

    const dependents = findDependentStepsAfter(actions, index);

    if (dependents.length === 0) {
      commit();
      return;
    }

    confirmDialog(
      `步骤 ${index + 1} 的结果正被后续步骤引用，仍要更改类型吗？`,
      `${listSteps(dependents)} 引用了该步骤的结果，更改类型后这些引用将失效。`,
      {
        okText: "仍然更改",
        cancelText: "取消",
        onOk: commit
      }
    );
  };

  const addAction = (): void => {
    const seed = availableActions[0]?.value;

    if (seed === undefined) {
      return;
    }

    const created = createActionFor(seed, actions);

    setExpandedKeys(previous => new Set(previous).add(actionKey(created, actions.length)));
    onChange([...actions, created]);
  };

  const commitModal = (index: number, next: ModalEditableAction): void => {
    const previous = actions[index];
    const previousOutput = previous && getStepOutputName(previous);
    const replaced = actions.with(index, writeActionOutput(next, previousOutput));

    // Renamed from the old name, so the references after it follow in the same
    // undo step.
    onChange(renameStepOutputInRule(replaced, index, getStepOutputName(next)));
  };

  const handleDragEnd: DragEndHandler = (event, manager) => {
    const reordered = reorderRows(actions, actionKeys(actions), event)?.rows.map(action => identified(action));

    if (reordered === undefined) {
      return;
    }

    const broken = findBrokenStepReferences(reordered);

    if (broken.length === 0) {
      onChange(reordered);
      return;
    }

    setProposed(reordered);

    // Asked once the order is rendered: the native fallback answers at once.
    void manager.renderer.rendering.then(() => confirmDialog(
      "调整顺序后部分步骤的引用将失效，仍要移动吗？",
      broken
        .map(item => `步骤 ${item.consumerIndex + 1} 引用了结果「${item.stepName}」，它要到步骤 ${item.producerIndex + 1} 才产生`)
        .join("；"),
      {
        okText: "仍然移动",
        cancelText: "取消",
        onOk: () => {
          setProposed(null);
          onChange(reordered);
        },
        onCancel: () => setProposed(null)
      }
    ));
  };

  return (
    <div css={sectionCss}>
      <span css={sectionLabelCss}>THEN</span>

      <DragDropProvider modifiers={[RestrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        <div css={actionsListCss}>
          {shown.map((action, index) => {
            const key = actionKey(action, index);

            return (
              <ActionEditor
                key={key}
                action={action}
                actions={shown}
                attention={attention?.key === key ? attention : null}
                availableActions={availableActions}
                expanded={expandedKeys.has(key)}
                index={index}
                issueSeverity={proposed === null ? severities.get(index) : undefined}
                priorSteps={priorStepsByIndex[index]}
                scope={scope}
                selfKey={selfKey}
                sortableId={key}
                unsupportedReason={unsupportedReasonFor(action, hasRequest, hasNavigate)}
                onChange={next => updateAt(index, next)}
                onChangeType={nextType => changeTypeAt(index, nextType)}
                onOpenModal={target => setModalSession(previous => {
                  return {
                    key: (previous?.key ?? 0) + 1,
                    actionIndex: index,
                    action: target,
                    open: true
                  };
                })}
                onRemove={() => removeAt(index)}
                onRenameOutput={nextOutput => onChange(renameStepOutputInRule(actions, index, nextOutput))}
                onToggleExpand={() => toggleExpand(key)}
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
              actions={actions}
              index={modalSession.actionIndex}
              open={modalSession.open}
              priorSteps={priorStepsByIndex[modalSession.actionIndex] ?? []}
              scope={scope}
              selfKey={selfKey}
              onAfterClose={() => setModalSession(current => current?.open ? current : null)}
              onClose={() => setModalSession(current => current && { ...current, open: false })}
              onSubmit={next => commitModal(modalSession.actionIndex, next)}
            />
          )}
    </div>
  );
};
