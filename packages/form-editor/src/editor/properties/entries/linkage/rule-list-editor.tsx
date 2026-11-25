import type { DropdownMenuItem } from "@vef-framework-react/components";
import type { FC } from "react";

import type { ValidationIssue } from "../../../../engine/validation";
import type {
  FieldLinkageAction,
  FieldLinkageRule,
  LinkageTrigger,
  LinkageTriggerKind
} from "../../../../types";
import type { LinkageRuleTemplate } from "./templates";
import type { LinkageScope } from "./use-linkage-editor-model";

import { css } from "@emotion/react";
import { Button, Dropdown, globalCssVars } from "@vef-framework-react/components";
import { useLatest } from "@vef-framework-react/hooks";
import { memo, useCallback, useEffect, useState } from "react";

import { isEffectAction } from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { useFormEditorStore, useFormEditorStoreApi } from "../../../../store/form-store";
import { ReferenceScopeProvider } from "../../reference-scope";
import { ActionsEditor } from "./actions-editor";
import { reconcileRuleTrigger, switchRuleTrigger, triggerSwitchStripsStateActions } from "./mutators";
import { seedSourceKey } from "./options";
import { RuleDiagnostics } from "./rule-diagnostics";
import {
  addButtonCss,
  deleteButtonCss,
  emptyBlockedCss,
  emptyCss,
  ruleBodyCss,
  ruleCardCss,
  ruleHeaderCss,
  ruleIndexCss,
  ruleListRootCss,
  rulesCss,
  ruleTitleCss
} from "./styles";
import { TriggerEditor } from "./trigger-editor";
import { useAttention } from "./use-attention";

const EMPTY_ISSUES: readonly ValidationIssue[] = [];
const NO_TEMPLATES: readonly LinkageRuleTemplate[] = [];

const addActionsBarCss = css({
  display: "flex",
  alignItems: "center",
  gap: 8
});

const primaryAddButtonCss = css({
  flex: 1,
  minWidth: 0
});

const templateOptionCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  lineHeight: 1.4
});

const templateDescCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const ruleCardHighlightedCss = css({
  borderColor: globalCssVars.colorPrimary,
  boxShadow: `0 0 0 2px ${globalCssVars.colorPrimaryBg}`
});

/**
 * The rule (and the step inside it) a diagnostic jumped to; a new object per
 * jump.
 */
interface RuleFocus {
  ruleId: string;
  actionIndex?: number;
}

export interface RuleListEditorProps {
  rules: FieldLinkageRule[];
  /**
   * The node owning the rules; `null` for the form's own events.
   */
  ownerNodeId: string | null;
  /**
   * What the rules can read and write.
   */
  scope: LinkageScope;
  /**
   * Trigger kinds offered, by scope (field vs container vs form).
   */
  triggerKinds: readonly LinkageTriggerKind[];
  /**
   * Whether state actions are offered (field / container scope yes, form
   * scope no).
   */
  allowStateActions: boolean;
  isTargetKeyed: boolean;
  /**
   * Whether the rule target is a container — narrows the state-action palette
   * to `show` / `hide` / `enable` / `disable`.
   */
  isContainerTarget?: boolean;
  /**
   * How the owning control commits; present where `commit` is offered.
   */
  commitHint?: string;
  /**
   * The owning block's data-binding key (when keyed).
   */
  selfKey?: string;
  /**
   * Localized noun for the empty state and add button ("联动" / "事件").
   */
  noun: string;
  /**
   * Live validator issues mapped per rule id (see `groupIssuesByRule`); each
   * card renders its own bucket.
   */
  issuesByRule: ReadonlyMap<string, ValidationIssue[]>;
  /**
   * Ready-made rules offered beside the add button.
   */
  templates?: readonly LinkageRuleTemplate[];
  /**
   * When set, the "add rule" button is disabled and this text explains why
   * (e.g. a container scope with no keyed field to build a condition from).
   */
  addDisabledReason?: string;
  /**
   * Build a fresh rule when the user clicks add (scope-specific default).
   */
  createRule: () => FieldLinkageRule;
  onChange: (rules: FieldLinkageRule[]) => void;
}

/**
 * The shared rule-list editor: an add/remove list of rules, each a
 * {@link TriggerEditor} (WHEN) over an {@link ActionsEditor} (THEN). Field
 * linkage, container linkage, and the form-level events panel all render
 * through it, differing only in the allowed triggers, the action palette,
 * templates, and the new-rule seed.
 */
export const RuleListEditor: FC<RuleListEditorProps> = ({
  addDisabledReason,
  allowStateActions,
  commitHint,
  createRule,
  isContainerTarget = false,
  isTargetKeyed,
  issuesByRule,
  noun,
  onChange,
  ownerNodeId,
  rules,
  scope,
  selfKey,
  templates = NO_TEMPLATES,
  triggerKinds
}) => {
  // Latest-value refs so the per-rule handlers stay referentially stable across
  // renders (feeding RuleCard's memo) while still reading the current rules /
  // onChange. A keystroke in one rule then re-renders only that rule's card, not
  // every sibling (and their mounted CodeMirrors).
  const rulesRef = useLatest(rules);
  const onChangeRef = useLatest(onChange);
  const allowStateActionsRef = useLatest(allowStateActions);
  const createRuleRef = useLatest(createRule);
  const scopeRef = useLatest(scope);
  const selfKeyRef = useLatest(selfKey);

  const storeApi = useFormEditorStoreApi();
  const pendingFocus = useFormEditorStore(s => s.pendingLinkageFocus?.nodeId === ownerNodeId ? s.pendingLinkageFocus : null);
  const [focus, setFocus] = useState<RuleFocus | null>(null);

  useEffect(() => {
    if (pendingFocus === null) {
      return;
    }

    storeApi.getState().clearPendingLinkageFocus();

    const rule = rulesRef.current[pendingFocus.ruleIndex];

    if (rule !== undefined) {
      setFocus({ ruleId: rule.id, actionIndex: pendingFocus.actionIndex });
    }
  }, [pendingFocus, rulesRef, storeApi]);

  const updateRule = useCallback(
    (ruleId: string, updater: (rule: FieldLinkageRule) => FieldLinkageRule): void => {
      onChangeRef.current(rulesRef.current.map(rule => rule.id === ruleId ? updater(rule) : rule));
    },
    [onChangeRef, rulesRef]
  );

  const handleRemove = useCallback(
    (ruleId: string): void => {
      onChangeRef.current(rulesRef.current.filter(rule => rule.id !== ruleId));
    },
    [onChangeRef, rulesRef]
  );

  const handleActionsChange = useCallback(
    (ruleId: string, actions: FieldLinkageAction[]): void => {
      updateRule(ruleId, current => {
        return { ...current, actions };
      });
    },
    [updateRule]
  );

  const handleTriggerChange = useCallback(
    (ruleId: string, trigger: LinkageTrigger): void => {
      updateRule(ruleId, current => reconcileRuleTrigger(current, trigger, allowStateActionsRef.current));
    },
    [allowStateActionsRef, updateRule]
  );

  const handleTriggerKindSwitch = useCallback(
    (ruleId: string, nextKind: LinkageTriggerKind): void => {
      const { fieldOptions } = scopeRef.current.reference;
      const fallback = seedSourceKey(fieldOptions, selfKeyRef.current) ?? fieldOptions[0]?.value;

      updateRule(ruleId, current => switchRuleTrigger(current, nextKind, allowStateActionsRef.current, fallback));
    },
    [allowStateActionsRef, scopeRef, selfKeyRef, updateRule]
  );

  const handleFocusAction = useCallback((ruleId: string, actionIndex: number): void => {
    setFocus({ ruleId, actionIndex });
  }, []);

  const addRule = useCallback((): void => {
    onChangeRef.current([...rulesRef.current, createRuleRef.current()]);
  }, [createRuleRef, onChangeRef, rulesRef]);

  const addTemplateRule = useCallback(
    (template: LinkageRuleTemplate): void => {
      onChangeRef.current([...rulesRef.current, template.create()]);
    },
    [onChangeRef, rulesRef]
  );

  const templateMenuItems: DropdownMenuItem[] = templates.map(template => {
    return {
      key: template.id,
      label: (
        <div css={templateOptionCss}>
          <span>{template.label}</span>
          <span css={templateDescCss}>{template.description}</span>
        </div>
      )
    };
  });

  return (
    <div css={ruleListRootCss}>
      {rules.length === 0
        ? (
            <div css={[emptyCss, addDisabledReason !== undefined && emptyBlockedCss]}>
              <EditorIcon name={addDisabledReason === undefined ? "git-branch" : "triangle-alert"} />
              <span>{addDisabledReason ?? `还没有${noun}规则`}</span>
            </div>
          )
        : (
            <div css={rulesCss}>
              {rules.map((rule, index) => (
                // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
                <RuleCard
                  key={rule.id}
                  allowStateActions={allowStateActions}
                  commitHint={commitHint}
                  focus={focus?.ruleId === rule.id ? focus : null}
                  index={index}
                  isContainerTarget={isContainerTarget}
                  issues={issuesByRule.get(rule.id) ?? EMPTY_ISSUES}
                  isTargetKeyed={isTargetKeyed}
                  rule={rule}
                  scope={scope}
                  selfKey={selfKey}
                  triggerKinds={triggerKinds}
                  onActionsChange={handleActionsChange}
                  onFocusAction={handleFocusAction}
                  onRemove={handleRemove}
                  onTriggerChange={handleTriggerChange}
                  onTriggerKindSwitch={handleTriggerKindSwitch}
                />
              ))}
            </div>
          )}

      {templates.length > 0 && addDisabledReason === undefined
        ? (
            <div css={addActionsBarCss}>
              <Button
                css={[addButtonCss, primaryAddButtonCss]}
                icon={<EditorIcon name="plus" />}
                onClick={addRule}
              >
                {`新建${noun}规则`}
              </Button>

              <Dropdown
                placement="topRight"
                trigger={["click"]}
                menu={{
                  items: templateMenuItems,
                  onClick: event => {
                    const picked = templates.find(item => item.id === event.key);

                    if (picked !== undefined) {
                      addTemplateRule(picked);
                    }
                  }
                }}
              >
                <Button icon={<EditorIcon name="clipboard-list" />}>
                  模板
                </Button>
              </Dropdown>
            </div>
          )
        : (
            <Button
              block
              css={addButtonCss}
              disabled={addDisabledReason !== undefined}
              icon={<EditorIcon name="plus" />}
              title={addDisabledReason}
              onClick={addRule}
            >
              {`新建${noun}规则`}
            </Button>
          )}
    </div>
  );
};

interface RuleCardProps {
  allowStateActions: boolean;
  commitHint?: string;
  focus: RuleFocus | null;
  index: number;
  isContainerTarget: boolean;
  isTargetKeyed: boolean;
  issues: readonly ValidationIssue[];
  rule: FieldLinkageRule;
  scope: LinkageScope;
  selfKey?: string;
  triggerKinds: readonly LinkageTriggerKind[];
  onActionsChange: (ruleId: string, actions: FieldLinkageAction[]) => void;
  onFocusAction: (ruleId: string, actionIndex: number) => void;
  onRemove: (ruleId: string) => void;
  onTriggerChange: (ruleId: string, trigger: LinkageTrigger) => void;
  onTriggerKindSwitch: (ruleId: string, nextKind: LinkageTriggerKind) => void;
}

const RuleCardBase: FC<RuleCardProps> = ({
  allowStateActions,
  commitHint,
  focus,
  index,
  isContainerTarget,
  isTargetKeyed,
  issues,
  onActionsChange,
  onFocusAction,
  onRemove,
  onTriggerChange,
  onTriggerKindSwitch,
  rule,
  scope,
  selfKey,
  triggerKinds
}) => {
  const { highlighted, ref } = useAttention(focus !== null && focus.actionIndex === undefined ? focus : null);

  return (
    // A rule card is a composite of related controls (trigger + actions +
    // diagnostics) — expose it as a labelled group so assistive tech (and
    // accessible queries) can address one rule.
    <div
      ref={ref}
      aria-label={`规则 ${index + 1}`}
      css={[ruleCardCss, highlighted && ruleCardHighlightedCss]}
      role="group"
    >
      <div css={ruleHeaderCss}>
        <span css={ruleIndexCss}>{index + 1}</span>

        <span css={ruleTitleCss}>
          规则
          {index + 1}
        </span>

        <Button
          aria-label={`删除规则 ${index + 1}`}
          css={deleteButtonCss}
          icon={<EditorIcon name="trash-2" />}
          title="删除规则"
          type="text"
          onClick={() => onRemove(rule.id)}
        />
      </div>

      <ReferenceScopeProvider value={scope.reference}>
        <div css={ruleBodyCss}>
          <TriggerEditor
            commitHint={commitHint}
            confirmKindSwitch={triggerSwitchStripsStateActions(rule)}
            hasEffectActions={rule.actions.some(action => isEffectAction(action))}
            selfKey={selfKey}
            trigger={rule.trigger}
            triggerKinds={triggerKinds}
            onChange={trigger => onTriggerChange(rule.id, trigger)}
            onKindSwitch={nextKind => onTriggerKindSwitch(rule.id, nextKind)}
          />

          <ActionsEditor
            actions={rule.actions}
            allowStateActions={allowStateActions}
            focus={focus}
            isContainerTarget={isContainerTarget}
            issues={issues}
            isTargetKeyed={isTargetKeyed}
            scope={scope}
            selfKey={selfKey}
            triggerKind={rule.trigger.kind}
            onChange={actions => onActionsChange(rule.id, actions)}
          />

          <RuleDiagnostics
            issues={issues}
            onFocusAction={actionIndex => onFocusAction(rule.id, actionIndex)}
          />
        </div>
      </ReferenceScopeProvider>
    </div>
  );
};

/**
 * Memoized so a keystroke in one rule re-renders only that rule's card: the
 * edited rule's `rule` reference changes while every sibling's stays identity-
 * stable (the list edit preserves untouched rules), and all the option / handler
 * props above are referentially stable, so the shallow prop compare skips the
 * rest — and their mounted CodeMirrors never reconfigure.
 */
const RuleCard = memo(RuleCardBase);
