import type { DropdownMenuItem } from "@vef-framework-react/components";
import type { FC } from "react";

import type { WritableTargetField } from "../../../../engine/linkage";
import type { ValidationIssue } from "../../../../engine/validation";
import type {
  FieldLinkageAction,
  FieldLinkageRule,
  FormDataSource,
  FormField,
  FormVariable,
  KeyedFormField,
  LinkageTrigger,
  LinkageTriggerKind
} from "../../../../types";
import type { ActionFocusSignal } from "./actions-editor";
import type { SourceFieldOption } from "./options";
import type { LinkageRuleTemplate } from "./templates";

import { css } from "@emotion/react";
import { Button, Dropdown, globalCssVars } from "@vef-framework-react/components";
import { useLatest } from "@vef-framework-react/hooks";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { isEffectAction } from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { useFormEditorStore, useFormEditorStoreApi } from "../../../../store/form-store";
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

const EMPTY_ISSUES: readonly ValidationIssue[] = [];
const EMPTY_DATA_SOURCES: readonly FormDataSource[] = [];
const EMPTY_VARIABLES: readonly FormVariable[] = [];
const EMPTY_TARGETS: readonly WritableTargetField[] = [];
const EMPTY_SCOPE_FIELDS: ReadonlyMap<string, KeyedFormField> = new Map();
const EMPTY_TEMPLATES: readonly LinkageRuleTemplate[] = [];

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

export interface RuleListEditorProps {
  rules: FieldLinkageRule[];
  /**
   * Scope identity for consuming diagnostic jumps (`pendingLinkageFocus`):
   * pass the owning node id for field / container rules, `null` for form-level
   * events, or omit when rendered standalone.
   */
  scopeNodeId?: string | null;
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
   * Control-specific description for the `commit` trigger.
   */
  commitHint?: string;
  /**
   * Owning field for typed literal input on `assign`.
   */
  ownerField?: FormField;
  /**
   * Keyed fields offered as a condition's source and reference picker fields.
   */
  sourceOptions: SourceFieldOption[];
  /**
   * Form-global declared variables for unified condition and reference pickers.
   */
  variables?: readonly FormVariable[];
  /**
   * The owning block's data-binding key (when keyed).
   */
  selfKey?: string;
  /**
   * Keyed fields offered as `set_fields` targets.
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
   * Localized noun for the empty state and add button ("联动" / "事件").
   */
  noun: string;
  /**
   * Live validator issues mapped per rule id (see `groupIssuesByRule`); each
   * card renders its own bucket. Omitted means no diagnostics surface.
   */
  issuesByRule?: ReadonlyMap<string, ValidationIssue[]>;
  /**
   * Optional starter templates offered beside "新建规则" (e.g. "查询并回填").
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
 * starter templates, and the new-rule seed.
 */
export const RuleListEditor: FC<RuleListEditorProps> = ({
  addDisabledReason,
  allowStateActions,
  commitHint,
  createRule,
  dataSourceOptions,
  dataSources = EMPTY_DATA_SOURCES,
  isContainerTarget = false,
  isTargetKeyed,
  issuesByRule,
  noun,
  onChange,
  ownerField,
  rules,
  scopeFieldsByKey = EMPTY_SCOPE_FIELDS,
  scopeNodeId,
  selfKey,
  sourceOptions,
  targetOptions,
  templates = EMPTY_TEMPLATES,
  triggerKinds,
  variables = EMPTY_VARIABLES,
  writableTargets = EMPTY_TARGETS
}) => {
  // Latest-value refs so the per-rule handlers stay referentially stable across
  // renders (feeding RuleCard's memo) while still reading the current rules /
  // onChange. A keystroke in one rule then re-renders only that rule's card, not
  // every sibling (and their mounted CodeMirrors).
  const rulesRef = useLatest(rules);
  const onChangeRef = useLatest(onChange);
  const allowStateActionsRef = useLatest(allowStateActions);
  const createRuleRef = useLatest(createRule);
  const sourceOptionsRef = useLatest(sourceOptions);
  const selfKeyRef = useLatest(selfKey);

  const storeApi = useFormEditorStoreApi();
  const pendingFocus = useFormEditorStore(s => s.pendingLinkageFocus);
  const ruleCardRefs = useRef(new Map<string, HTMLDivElement>());
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);
  const [focusByRuleId, setFocusByRuleId] = useState<{ ruleId: string; signal: ActionFocusSignal } | null>(null);

  // Consume diagnostic jumps aimed at this rule list's scope, scrolling the
  // target rule into view and forwarding any step index to its ActionsEditor.
  useEffect(() => {
    if (pendingFocus === null || scopeNodeId === undefined) {
      return;
    }

    const matchesScope = scopeNodeId === null
      ? pendingFocus.scope === "form"
      : pendingFocus.scope === "node" && pendingFocus.nodeId === scopeNodeId;

    if (!matchesScope) {
      return;
    }

    storeApi.getState().clearPendingLinkageFocus();

    const targetRule = rules[pendingFocus.ruleIndex];

    if (targetRule === undefined) {
      return;
    }

    if (pendingFocus.actionIndex === undefined) {
      setHighlightedRuleId(targetRule.id);
      const frame = globalThis.requestAnimationFrame?.(() => {
        ruleCardRefs.current.get(targetRule.id)?.scrollIntoView?.({ block: "nearest" });
      });
      const timer = setTimeout(() => {
        setHighlightedRuleId(current => current === targetRule.id ? null : current);
      }, 1800);

      return () => {
        if (frame !== undefined) {
          globalThis.cancelAnimationFrame?.(frame);
        }

        clearTimeout(timer);
      };
    }

    setFocusByRuleId(prev => {
      return {
        ruleId: targetRule.id,
        signal: {
          index: pendingFocus.actionIndex as number,
          nonce: (prev?.signal.nonce ?? 0) + 1
        }
      };
    });
  }, [pendingFocus, scopeNodeId, rules, storeApi]);

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
      const fallback = seedSourceKey(sourceOptionsRef.current, selfKeyRef.current)
        ?? sourceOptionsRef.current[0]?.value;

      updateRule(ruleId, current => switchRuleTrigger(current, nextKind, allowStateActionsRef.current, fallback));
    },
    [allowStateActionsRef, selfKeyRef, sourceOptionsRef, updateRule]
  );

  const handleFocusAction = useCallback((ruleId: string, actionIndex: number): void => {
    setFocusByRuleId(prev => {
      return {
        ruleId,
        signal: {
          index: actionIndex,
          nonce: (prev?.signal.nonce ?? 0) + 1
        }
      };
    });
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
                  dataSourceOptions={dataSourceOptions}
                  dataSources={dataSources}
                  focusActionSignal={focusByRuleId?.ruleId === rule.id ? focusByRuleId.signal : null}
                  highlighted={highlightedRuleId === rule.id}
                  index={index}
                  isContainerTarget={isContainerTarget}
                  issues={issuesByRule?.get(rule.id) ?? EMPTY_ISSUES}
                  isTargetKeyed={isTargetKeyed}
                  ownerField={ownerField}
                  rule={rule}
                  scopeFieldsByKey={scopeFieldsByKey}
                  selfKey={selfKey}
                  sourceOptions={sourceOptions}
                  targetOptions={targetOptions}
                  triggerKinds={triggerKinds}
                  variables={variables}
                  writableTargets={writableTargets}
                  cardRef={node => {
                    if (node === null) {
                      ruleCardRefs.current.delete(rule.id);
                    } else {
                      ruleCardRefs.current.set(rule.id, node);
                    }
                  }}
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
  dataSourceOptions: SourceFieldOption[];
  dataSources: readonly FormDataSource[];
  focusActionSignal: ActionFocusSignal | null;
  highlighted: boolean;
  index: number;
  isContainerTarget: boolean;
  isTargetKeyed: boolean;
  issues: readonly ValidationIssue[];
  ownerField?: FormField;
  rule: FieldLinkageRule;
  scopeFieldsByKey: ReadonlyMap<string, KeyedFormField>;
  selfKey?: string;
  sourceOptions: SourceFieldOption[];
  targetOptions: SourceFieldOption[];
  triggerKinds: readonly LinkageTriggerKind[];
  variables: readonly FormVariable[];
  writableTargets: readonly WritableTargetField[];
  cardRef: (node: HTMLDivElement | null) => void;
  onActionsChange: (ruleId: string, actions: FieldLinkageAction[]) => void;
  onFocusAction: (ruleId: string, actionIndex: number) => void;
  onRemove: (ruleId: string) => void;
  onTriggerChange: (ruleId: string, trigger: LinkageTrigger) => void;
  onTriggerKindSwitch: (ruleId: string, nextKind: LinkageTriggerKind) => void;
}

const RuleCardBase: FC<RuleCardProps> = ({
  allowStateActions,
  cardRef,
  commitHint,
  dataSourceOptions,
  dataSources,
  focusActionSignal,
  highlighted,
  index,
  isContainerTarget,
  isTargetKeyed,
  issues,
  onActionsChange,
  onFocusAction,
  onRemove,
  onTriggerChange,
  onTriggerKindSwitch,
  ownerField,
  rule,
  scopeFieldsByKey,
  selfKey,
  sourceOptions,
  targetOptions,
  triggerKinds,
  variables,
  writableTargets
}) => {
  // Guards carry across trigger switches (`when` ↔ `condition`), so only
  // leaving a `condition` trigger that carries state actions loses work.
  const confirmKindSwitch = triggerSwitchStripsStateActions(rule);
  const hasEffectActions = rule.actions.some(action => isEffectAction(action));

  return (
    // A rule card is a composite of related controls (trigger + actions +
    // diagnostics) — expose it as a labelled group so assistive tech (and
    // accessible queries) can address one rule.
    <div
      ref={cardRef}
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

      <div css={ruleBodyCss}>
        <TriggerEditor
          commitHint={commitHint}
          confirmKindSwitch={confirmKindSwitch}
          hasEffectActions={hasEffectActions}
          selfKey={selfKey}
          sourceOptions={sourceOptions}
          trigger={rule.trigger}
          triggerKinds={triggerKinds}
          variables={variables}
          onChange={trigger => onTriggerChange(rule.id, trigger)}
          onKindSwitch={nextKind => onTriggerKindSwitch(rule.id, nextKind)}
        />

        <ActionsEditor
          actions={rule.actions}
          allowStateActions={allowStateActions}
          dataSourceOptions={dataSourceOptions}
          dataSources={dataSources}
          focusSignal={focusActionSignal}
          isContainerTarget={isContainerTarget}
          isTargetKeyed={isTargetKeyed}
          ownerField={ownerField}
          ruleIssues={issues}
          scopeFieldsByKey={scopeFieldsByKey}
          sourceOptions={sourceOptions}
          targetOptions={targetOptions}
          triggerKind={rule.trigger.kind}
          variables={variables}
          writableTargets={writableTargets}
          onChange={actions => onActionsChange(rule.id, actions)}
        />

        <RuleDiagnostics
          issues={issues}
          onFocusAction={actionIndex => onFocusAction(rule.id, actionIndex)}
        />
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
