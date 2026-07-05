import type { FC } from "react";

import type { ValidationIssue } from "../../../../engine/validation";
import type { FieldLinkageAction, FieldLinkageRule, LinkageTrigger, LinkageTriggerKind } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { Button } from "@vef-framework-react/components";
import { useLatest } from "@vef-framework-react/hooks";
import { memo, useCallback } from "react";

import { isStateAction } from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { ActionsEditor } from "./actions-editor";
import { conditionHasAuthoredContent, reconcileRuleTrigger } from "./mutators";
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

const EMPTY_ISSUES: readonly ValidationIssue[] = [];

export interface RuleListEditorProps {
  rules: FieldLinkageRule[];
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
   * Keyed fields offered as a condition's source. Includes the rule's own
   * field: keying a rule off its own value is legal (the validator flags only
   * the genuinely cyclic case — a value-writing `assign` / `script` rule
   * reading its own key).
   */
  sourceOptions: SourceFieldOption[];
  /**
   * The owning block's data-binding key (when keyed). Seeds the expression →
   * visual switch with a different field, mirroring rule creation.
   */
  selfKey?: string;
  /**
   * Keyed fields offered as a `set_field` target — includes the rule's own
   * field (writing one's own value, e.g. normalising on blur, is legitimate).
   */
  targetOptions: SourceFieldOption[];
  /**
   * Form-global data sources offered as a `refresh_data_source` target.
   */
  dataSourceOptions: SourceFieldOption[];
  /**
   * Localized noun for the empty state and add button ("联动" / "事件").
   */
  noun: string;
  /**
   * Live validator issues mapped per rule id (see `groupIssuesByRule`); each
   * card renders its own bucket. Omitted means no diagnostics surface.
   */
  issuesByRule?: ReadonlyMap<string, ValidationIssue[]>;
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
 * through it, differing only in the allowed triggers, the action palette, and
 * the new-rule seed.
 */
export const RuleListEditor: FC<RuleListEditorProps> = ({
  addDisabledReason,
  allowStateActions,
  createRule,
  dataSourceOptions,
  isContainerTarget = false,
  isTargetKeyed,
  issuesByRule,
  noun,
  rules,
  selfKey,
  sourceOptions,
  targetOptions,
  triggerKinds,
  onChange
}) => {
  // Latest-value refs so the per-rule handlers stay referentially stable across
  // renders (feeding RuleCard's memo) while still reading the current rules /
  // onChange. A keystroke in one rule then re-renders only that rule's card, not
  // every sibling (and their mounted CodeMirrors).
  const rulesRef = useLatest(rules);
  const onChangeRef = useLatest(onChange);
  const allowStateActionsRef = useLatest(allowStateActions);
  const createRuleRef = useLatest(createRule);

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

  const addRule = useCallback((): void => {
    onChangeRef.current([...rulesRef.current, createRuleRef.current()]);
  }, [createRuleRef, onChangeRef, rulesRef]);

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
                  dataSourceOptions={dataSourceOptions}
                  index={index}
                  isContainerTarget={isContainerTarget}
                  issues={issuesByRule?.get(rule.id) ?? EMPTY_ISSUES}
                  isTargetKeyed={isTargetKeyed}
                  rule={rule}
                  selfKey={selfKey}
                  sourceOptions={sourceOptions}
                  targetOptions={targetOptions}
                  triggerKinds={triggerKinds}
                  onActionsChange={handleActionsChange}
                  onRemove={handleRemove}
                  onTriggerChange={handleTriggerChange}
                />
              ))}
            </div>
          )}

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
    </div>
  );
};

interface RuleCardProps {
  allowStateActions: boolean;
  dataSourceOptions: SourceFieldOption[];
  index: number;
  isContainerTarget: boolean;
  isTargetKeyed: boolean;
  issues: readonly ValidationIssue[];
  rule: FieldLinkageRule;
  selfKey?: string;
  sourceOptions: SourceFieldOption[];
  targetOptions: SourceFieldOption[];
  triggerKinds: readonly LinkageTriggerKind[];
  onActionsChange: (ruleId: string, actions: FieldLinkageAction[]) => void;
  onRemove: (ruleId: string) => void;
  onTriggerChange: (ruleId: string, trigger: LinkageTrigger) => void;
}

const RuleCardBase: FC<RuleCardProps> = ({
  allowStateActions,
  dataSourceOptions,
  index,
  isContainerTarget,
  isTargetKeyed,
  issues,
  rule,
  selfKey,
  sourceOptions,
  targetOptions,
  triggerKinds,
  onActionsChange,
  onRemove,
  onTriggerChange
}) => {
  // Leaving a `condition` trigger discards its condition tree and strips any
  // state actions (see `reconcileRuleTrigger`) — confirm when that loses real
  // work. Edge triggers carry no payload, so switching between them is instant.
  const confirmKindSwitch = rule.trigger.kind === "condition"
    && (conditionHasAuthoredContent(rule.trigger.condition) || rule.actions.some(action => isStateAction(action)));

  return (
    // A rule card is a composite of related controls (trigger + actions +
    // diagnostics) — expose it as a labelled group so assistive tech (and
    // accessible queries) can address one rule.
    <div aria-label={`规则 ${index + 1}`} css={ruleCardCss} role="group">
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

      <div css={ruleBodyCss}>
        <TriggerEditor
          confirmKindSwitch={confirmKindSwitch}
          selfKey={selfKey}
          sourceOptions={sourceOptions}
          trigger={rule.trigger}
          triggerKinds={triggerKinds}
          onChange={trigger => onTriggerChange(rule.id, trigger)}
        />

        <ActionsEditor
          actions={rule.actions}
          allowStateActions={allowStateActions}
          dataSourceOptions={dataSourceOptions}
          isContainerTarget={isContainerTarget}
          isTargetKeyed={isTargetKeyed}
          targetOptions={targetOptions}
          triggerKind={rule.trigger.kind}
          onChange={actions => onActionsChange(rule.id, actions)}
        />

        <RuleDiagnostics issues={issues} />
      </div>
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
