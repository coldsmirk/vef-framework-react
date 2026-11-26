import type { DragDropEventHandlers } from "@vef-framework-react/core";
import type { FC } from "react";

import type { ValidationIssue, ValidationSeverity } from "../../../../engine/validation";
import type { FieldLinkageAction, LinkageActionType, LinkageTriggerKind } from "../../../../types";
import type { LinkageScope } from "./use-linkage-editor-model";

import { Button } from "@vef-framework-react/components";
import { DragDropProvider, RestrictToVerticalAxis } from "@vef-framework-react/core";
import { useLatest } from "@vef-framework-react/hooks";
import { useEffect, useMemo, useState } from "react";

import { createId } from "../../../../engine/ids";
import {
  findBrokenStepReferences,
  findDependentStepsAfter,
  isEffectAction,
  resolvePriorStepSchemas
} from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { useDataSourceApis } from "../../../data-source-apis";
import { parseLinkageIssuePath } from "../../../linkage-issue-path";
import { usePreviewRuntime } from "../../../preview-runtime-context";
import { confirmDialog } from "../../../toolbar/notify";
import { reorderRows } from "../../sortable-rows";
import { ActionEditor } from "./action-editor";
import { createActionFor } from "./mutators";
import { actionOptionsFor } from "./options";
import { actionKey } from "./step-output-drafts";
import { actionsListCss, addInlineButtonCss, sectionCss, sectionLabelCss } from "./styles";

type DragEndHandler = DragDropEventHandlers["onDragEnd"];

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
   * The draft rule's live validation issues.
   */
  issues: readonly ValidationIssue[];
  /**
   * The step to expand, scroll to, and highlight; a new object per request.
   */
  focus: { actionIndex?: number } | null;
  /**
   * Uncommitted output-name drafts keyed by {@link actionKey}.
   */
  outputDrafts: Readonly<Record<string, string>>;
  /**
   * Output-name validation errors keyed by {@link actionKey}.
   */
  outputErrors: ReadonlyMap<string, string>;
  onChange: (next: FieldLinkageAction[]) => void;
  onOutputChange: (key: string, nextText: string) => void;
  onOutputCommit: (index: number, key: string) => void;
  onClearOutputDraft: (key: string) => void;
}

/**
 * The THEN half of a rule inside the rule dialog: an ordered sequence of
 * collapsible, drag-sortable steps edited in place. A lone step opens expanded
 * and a longer sequence collapsed (plus any focused step) so the whole pipeline
 * is visible at a glance.
 */
export const ActionsEditor: FC<ActionsEditorProps> = ({
  actions,
  allowStateActions,
  focus,
  isContainerTarget,
  issues,
  isTargetKeyed,
  onChange,
  onClearOutputDraft,
  onOutputChange,
  onOutputCommit,
  outputDrafts,
  outputErrors,
  scope,
  selfKey,
  triggerKind
}) => {
  const { serviceCapabilities } = usePreviewRuntime();
  const hasRequest = serviceCapabilities?.hasRequest;
  const hasNavigate = serviceCapabilities?.hasNavigate;
  const apis = useDataSourceApis();
  const actionsRef = useLatest(actions);

  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => {
    const initial = new Set<string>(actions.length === 1 ? actionKeys(actions) : []);
    const focusIndex = focus?.actionIndex;
    const focused = focusIndex === undefined ? undefined : actions[focusIndex];

    if (focusIndex !== undefined && focused !== undefined) {
      initial.add(actionKey(focused, focusIndex));
    }

    return initial;
  });
  const [attention, setAttention] = useState<{ key: string } | null>(null);

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
    const target = actions[index];
    const key = target === undefined ? undefined : actionKey(target, index);

    const commit = (): void => {
      if (key !== undefined) {
        onClearOutputDraft(key);
      }

      onChange(actions.toSpliced(index, 1));
    };

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
        okIcon: "trash-2",
        cancelText: "取消",
        onOk: commit
      }
    );
  };

  const changeTypeAt = (index: number, nextType: LinkageActionType): void => {
    const target = actions[index];
    const key = target === undefined ? undefined : actionKey(target, index);

    const commit = (): void => {
      if (key !== undefined) {
        onClearOutputDraft(key);
      }

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
        okIcon: "replace",
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
        okIcon: "move-vertical",
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
                outputDraft={outputDrafts[key]}
                outputError={outputErrors.get(key) ?? null}
                priorSteps={priorStepsByIndex[index]}
                scope={scope}
                selfKey={selfKey}
                sortableId={key}
                unsupportedReason={unsupportedReasonFor(action, hasRequest, hasNavigate)}
                onChange={next => updateAt(index, next)}
                onChangeType={nextType => changeTypeAt(index, nextType)}
                onOutputChange={nextText => onOutputChange(key, nextText)}
                onOutputCommit={() => onOutputCommit(index, key)}
                onRemove={() => removeAt(index)}
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
    </div>
  );
};
