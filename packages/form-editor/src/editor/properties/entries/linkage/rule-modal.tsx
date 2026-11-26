import type { ReactElement } from "react";

import type {
  FieldLinkageAction,
  FieldLinkageRule,
  LinkageTrigger,
  LinkageTriggerKind
} from "../../../../types";
import type { DraftSession } from "../../use-draft-session";
import type { LinkageScope } from "./use-linkage-editor-model";

import { isDeepEqual } from "@vef-framework-react/shared";
import { useMemo, useRef, useState } from "react";

import { getStepOutputName, isEffectAction, renameStepOutputInRule } from "../../../../engine/linkage";
import { DraftModal } from "../../draft-modal";
import { ReferenceScopeProvider } from "../../reference-scope";
import { useFieldOptionsReferenceScope } from "../../scope-fields";
import { ActionsEditor } from "./actions-editor";
import { reconcileRuleTrigger, switchRuleTrigger, triggerSwitchStripsStateActions } from "./mutators";
import { seedSourceKey } from "./options";
import { RuleDiagnostics } from "./rule-diagnostics";
import {
  applyOutputDrafts,
  collectEffectiveOutputNames,
  computeOutputErrors,
  hasPendingOutputEdits,
  hasStepOutput,
  pruneOutputDrafts,
  stepOutputError
} from "./step-output-drafts";
import { TriggerEditor } from "./trigger-editor";
import { useDraftRuleIssues } from "./use-linkage-editor-model";

const MODAL_WIDTH = 960;

export interface RuleSessionMeta {
  /**
   * 1-based rule number shown in the edit dialog title; omitted when creating.
   */
  ruleNumber?: number;
  /**
   * Optional step to expand, scroll to, and highlight on open (diagnostic jump).
   */
  initialFocus: { actionIndex?: number } | null;
}

export type RuleDraftSession = DraftSession<FieldLinkageRule, RuleSessionMeta>;

export interface RuleDraftModalProps {
  session: RuleDraftSession;
  ownerNodeId: string | null;
  ownerLabel?: string;
  noun: string;
  scope: LinkageScope;
  triggerKinds: readonly LinkageTriggerKind[];
  allowStateActions: boolean;
  isTargetKeyed: boolean;
  isContainerTarget: boolean;
  commitHint?: string;
  selfKey?: string;
  onSave: (next: FieldLinkageRule) => void;
  onClose: () => void;
  onAfterClose: () => void;
}

function dialogTitle(session: RuleDraftSession, noun: string, ownerLabel: string | undefined): string {
  if (session.mode === "create") {
    return `新建${noun}规则`;
  }

  const label = `规则 ${session.extra.ruleNumber ?? 1}`;
  const trimmedOwner = ownerLabel?.trim();

  return trimmedOwner && trimmedOwner.length > 0 ? `${label} · ${trimmedOwner}` : label;
}

/**
 * Single-layer wide draft dialog for one linkage rule: hosts `TriggerEditor`
 * (WHEN), `ActionsEditor` (THEN, with complex steps edited in place), and live
 * draft `RuleDiagnostics`. Writes back as one undo step on 确定.
 */
export function RuleDraftModal({
  allowStateActions,
  commitHint,
  isContainerTarget,
  isTargetKeyed,
  noun,
  onAfterClose,
  onClose,
  onSave,
  ownerLabel,
  ownerNodeId,
  scope,
  selfKey,
  session,
  triggerKinds
}: RuleDraftModalProps): ReactElement {
  const [draft, setDraft] = useState<FieldLinkageRule>(() => structuredClone(session.initial));
  const [outputDrafts, setOutputDrafts] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<{ actionIndex?: number } | null>(session.extra.initialFocus);

  // Synced refs keep blur→submit in the same event turn consistent even if
  // React has not committed the blur's state update before 确定 clicks.
  const draftRef = useRef(draft);
  const outputDraftsRef = useRef(outputDrafts);
  draftRef.current = draft;
  outputDraftsRef.current = outputDrafts;

  // Built through the same shared hook as `NodeReferenceScopeProvider`, only
  // while this dialog is mounted so `$vars` edits never re-render closed rows.
  const referenceScope = useFieldOptionsReferenceScope(scope.fieldOptions);

  const issues = useDraftRuleIssues(ownerNodeId, draft);
  const { byKey: outputErrors } = useMemo(
    () => computeOutputErrors(draft.actions, outputDrafts),
    [draft.actions, outputDrafts]
  );

  const isDirty = hasPendingOutputEdits(draft.actions, outputDrafts) || !isDeepEqual(draft, session.initial);

  const updateDraft = (next: FieldLinkageRule): void => {
    draftRef.current = next;
    setDraft(next);
  };

  const updateOutputDrafts = (next: Record<string, string>): void => {
    if (next === outputDraftsRef.current) {
      return;
    }

    outputDraftsRef.current = next;
    setOutputDrafts(next);
  };

  const handleTriggerChange = (trigger: LinkageTrigger): void => {
    const next = reconcileRuleTrigger(draftRef.current, trigger, allowStateActions);

    updateDraft(next);
    updateOutputDrafts(pruneOutputDrafts(next.actions, outputDraftsRef.current));
  };

  const handleTriggerKindSwitch = (nextKind: LinkageTriggerKind): void => {
    const fallback = seedSourceKey(scope.fieldOptions, selfKey) ?? scope.fieldOptions[0]?.value;
    const next = switchRuleTrigger(draftRef.current, nextKind, allowStateActions, fallback);

    updateDraft(next);
    updateOutputDrafts(pruneOutputDrafts(next.actions, outputDraftsRef.current));
  };

  const handleActionsChange = (actions: FieldLinkageAction[]): void => {
    const next: FieldLinkageRule = { ...draftRef.current, actions };

    updateDraft(next);
    updateOutputDrafts(pruneOutputDrafts(actions, outputDraftsRef.current));
  };

  const handleOutputChange = (key: string, nextText: string): void => {
    updateOutputDrafts({ ...outputDraftsRef.current, [key]: nextText });
  };

  const handleClearOutputDraft = (key: string): void => {
    if (!Object.hasOwn(outputDraftsRef.current, key)) {
      return;
    }

    const next = { ...outputDraftsRef.current };
    delete next[key];
    updateOutputDrafts(next);
  };

  const handleOutputCommit = (index: number, key: string): void => {
    const currentDraft = draftRef.current;
    const currentOutputs = outputDraftsRef.current;

    if (!Object.hasOwn(currentOutputs, key)) {
      return;
    }

    const action = currentDraft.actions[index];

    if (action === undefined || !hasStepOutput(action)) {
      handleClearOutputDraft(key);
      return;
    }

    const nextText = currentOutputs[key] ?? "";
    const error = stepOutputError(
      nextText,
      action.type === "select_record",
      collectEffectiveOutputNames(currentDraft.actions, currentOutputs, index)
    );

    // Keep an invalid draft visible so the input does not silently revert and
    // 确定 can catch and highlight the offending step.
    if (error !== null) {
      return;
    }

    const committed = getStepOutputName(action) ?? "";

    if (nextText !== committed) {
      const renamed = renameStepOutputInRule(currentDraft.actions, index, nextText.length > 0 ? nextText : undefined);

      updateDraft({ ...currentDraft, actions: renamed });
    }

    handleClearOutputDraft(key);
  };

  const handleSubmit = (): void => {
    const currentDraft = draftRef.current;
    const currentOutputs = outputDraftsRef.current;
    const { firstInvalidIndex } = computeOutputErrors(currentDraft.actions, currentOutputs);

    if (firstInvalidIndex !== null) {
      setFocus({ actionIndex: firstInvalidIndex });
      return;
    }

    const finalRule = applyOutputDrafts(currentDraft, currentOutputs);

    if (session.mode === "edit" && isDeepEqual(finalRule, session.initial)) {
      onClose();
      return;
    }

    onSave(finalRule);
  };

  return (
    <DraftModal
      dirty={isDirty}
      open={session.open}
      title={dialogTitle(session, noun, ownerLabel)}
      width={MODAL_WIDTH}
      onAfterClose={onAfterClose}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <ReferenceScopeProvider value={referenceScope}>
        <TriggerEditor
          commitHint={commitHint}
          confirmKindSwitch={triggerSwitchStripsStateActions(draft)}
          hasEffectActions={draft.actions.some(action => isEffectAction(action))}
          selfKey={selfKey}
          trigger={draft.trigger}
          triggerKinds={triggerKinds}
          onChange={handleTriggerChange}
          onKindSwitch={handleTriggerKindSwitch}
        />

        <ActionsEditor
          actions={draft.actions}
          allowStateActions={allowStateActions}
          focus={focus}
          isContainerTarget={isContainerTarget}
          issues={issues}
          isTargetKeyed={isTargetKeyed}
          outputDrafts={outputDrafts}
          outputErrors={outputErrors}
          scope={scope}
          selfKey={selfKey}
          triggerKind={draft.trigger.kind}
          onChange={handleActionsChange}
          onClearOutputDraft={handleClearOutputDraft}
          onOutputChange={handleOutputChange}
          onOutputCommit={handleOutputCommit}
        />

        <RuleDiagnostics
          issues={issues}
          onFocusAction={actionIndex => setFocus({ actionIndex })}
        />
      </ReferenceScopeProvider>
    </DraftModal>
  );
}
