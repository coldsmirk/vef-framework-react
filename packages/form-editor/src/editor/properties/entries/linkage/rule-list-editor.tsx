import type { DropdownMenuItem } from "@vef-framework-react/components";
import type { FC } from "react";

import type { ValidationIssue, ValidationSeverity } from "../../../../engine/validation";
import type { LinkageFocusRef } from "../../../../store/form-store";
import type { FieldLinkageRule, LinkageTriggerKind } from "../../../../types";
import type { RuleSessionMeta } from "./rule-modal";
import type { LinkageRuleTemplate } from "./templates";
import type { LinkageScope } from "./use-linkage-editor-model";

import { css } from "@emotion/react";
import { Button, Dropdown, globalCssVars } from "@vef-framework-react/components";
import { useLatest } from "@vef-framework-react/hooks";
import { memo, useCallback } from "react";

import { EditorIcon } from "../../../../icons";
import { useFormEditorStore, useFormEditorStoreApi } from "../../../../store/form-store";
import { useDataSourceApis } from "../../../data-source-apis";
import {
  dataListItemsCss,
  dataListMetaDotCss,
  dataListNameCss,
  dataListPrimaryLineCss,
  DataListRow,
  dataListSecondaryLineCss,
  dataListSummaryCss,
  dataListWarningCss
} from "../../data-list";
import { useDraftSession } from "../../use-draft-session";
import { summarizeRuleActions } from "./action-summary";
import { cloneRule } from "./mutators";
import { RuleDraftModal } from "./rule-modal";
import {
  addButtonCss,
  emptyBlockedCss,
  emptyCss,
  ruleListRootCss
} from "./styles";
import { summarizeTrigger } from "./trigger-summary";

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

const ruleNumberBadgeCss = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  height: 18,
  padding: "0 5px",
  borderRadius: 4,
  background: globalCssVars.colorFillSecondary,
  color: globalCssVars.colorTextSecondary,
  fontSize: 11,
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1
});

const ruleIssueBadgeCss = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontVariantNumeric: "tabular-nums"
});

const ruleIssueErrorCss = css({
  color: globalCssVars.colorErrorText
});

const ruleIssueIconCss = css({
  display: "inline-flex",
  flexShrink: 0,
  fontSize: 11,

  "& svg": {
    width: 12,
    height: 12
  }
});

function worstSeverityOf(issues: readonly ValidationIssue[]): ValidationSeverity | undefined {
  let worst: ValidationSeverity | undefined;

  for (const issue of issues) {
    if (issue.severity === "error") {
      return "error";
    }

    worst = issue.severity;
  }

  return worst;
}

export interface RuleListEditorProps {
  rules: FieldLinkageRule[];
  /**
   * The node owning the rules; `null` for the form's own events.
   */
  ownerNodeId: string | null;
  /**
   * Display name of the owning field, container, or form-event section, used
   * in row trigger summaries and the rule dialog title.
   */
  ownerLabel?: string;
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
   * Localized noun for the empty state, add button, and create dialog title
   * ("联动" / "事件").
   */
  noun: string;
  /**
   * Live validator issues mapped per committed rule id (see `groupIssuesByRule`)
   * for the compact rows' issue badges.
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
 * Shared compact rule-list editor for field linkage, container linkage, and
 * form-level events. Renders each rule as a compact two-line `DataListRow` and
 * opens one rule at a time in a wide draft dialog ({@link RuleDraftModal}),
 * mounting trigger/action editors and CodeMirrors only while that dialog is
 * open.
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
  ownerLabel,
  ownerNodeId,
  rules,
  scope,
  selfKey,
  templates = NO_TEMPLATES,
  triggerKinds
}) => {
  // Latest-value refs keep row handlers referentially stable so memoized
  // `RuleRow` items skip re-rendering unless their own summary or active state
  // actually changed.
  const rulesRef = useLatest(rules);
  const onChangeRef = useLatest(onChange);
  const createRuleRef = useLatest(createRule);

  const apis = useDataSourceApis();
  const storeApi = useFormEditorStoreApi();
  const pendingFocus = useFormEditorStore(s => s.pendingLinkageFocus?.nodeId === ownerNodeId ? s.pendingLinkageFocus : null);

  const {
    close,
    closeIfEditing,
    editingId: editingRuleId,
    handleAfterClose,
    openCreate,
    openEdit,
    registerRow,
    session
  } = useDraftSession<FieldLinkageRule, LinkageFocusRef, RuleSessionMeta>({
    jump: {
      pending: pendingFocus,
      clear: () => storeApi.getState().clearPendingLinkageFocus(),
      resolve: focus => {
        const rule = rulesRef.current[focus.ruleIndex];

        if (rule === undefined) {
          return;
        }

        return {
          entry: rule,
          extra: {
            ruleNumber: focus.ruleIndex + 1,
            initialFocus: focus.actionIndex === undefined ? null : { actionIndex: focus.actionIndex }
          }
        };
      }
    }
  });

  const handleEdit = useCallback((ruleId: string): void => {
    const index = rulesRef.current.findIndex(rule => rule.id === ruleId);
    const target = index === -1 ? undefined : rulesRef.current[index];

    if (target !== undefined) {
      openEdit(target, { ruleNumber: index + 1, initialFocus: null });
    }
  }, [rulesRef, openEdit]);

  const handleDuplicate = useCallback((ruleId: string): void => {
    const index = rulesRef.current.findIndex(rule => rule.id === ruleId);
    const target = index === -1 ? undefined : rulesRef.current[index];

    if (target === undefined) {
      return;
    }

    onChangeRef.current(rulesRef.current.toSpliced(index + 1, 0, cloneRule(target)));
  }, [onChangeRef, rulesRef]);

  const handleRemove = useCallback((ruleId: string): void => {
    onChangeRef.current(rulesRef.current.filter(rule => rule.id !== ruleId));
    closeIfEditing(ruleId);
  }, [closeIfEditing, onChangeRef, rulesRef]);

  const handleSave = (nextRule: FieldLinkageRule): void => {
    const currentRules = rulesRef.current;
    const exists = currentRules.some(rule => rule.id === nextRule.id);

    onChangeRef.current(
      exists
        ? currentRules.map(rule => rule.id === nextRule.id ? nextRule : rule)
        : [...currentRules, nextRule]
    );
    close();
  };

  const addRule = useCallback((): void => {
    openCreate(createRuleRef.current(), { initialFocus: null });
  }, [createRuleRef, openCreate]);

  const addTemplateRule = useCallback((template: LinkageRuleTemplate): void => {
    openCreate(template.create(), { initialFocus: null });
  }, [openCreate]);

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

  const triggerSummaryScope = {
    fieldsByKey: scope.fieldsByKey,
    contextSources: scope.contextSources,
    ownerLabel: ownerNodeId === null ? undefined : ownerLabel
  };

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
            <div aria-label={`${noun}规则列表`} css={dataListItemsCss} role="list">
              {rules.map((rule, index) => {
                const ruleIssues = issuesByRule.get(rule.id) ?? EMPTY_ISSUES;

                return (
                  // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference to memoized row
                  <RuleRow
                    key={rule.id}
                    actionsSummary={summarizeRuleActions(rule.actions, scope, apis)}
                    active={editingRuleId === rule.id}
                    index={index}
                    issueCount={ruleIssues.length}
                    issueSeverity={worstSeverityOf(ruleIssues)}
                    ruleId={rule.id}
                    triggerSummary={summarizeTrigger(rule.trigger, triggerSummaryScope)}
                    onDelete={handleRemove}
                    onDuplicate={handleDuplicate}
                    onEdit={handleEdit}
                    onRegisterRow={registerRow}
                  />
                );
              })}
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

      {session === null
        ? null
        : (
            <RuleDraftModal
              key={session.key}
              allowStateActions={allowStateActions}
              commitHint={commitHint}
              isContainerTarget={isContainerTarget}
              isTargetKeyed={isTargetKeyed}
              noun={noun}
              ownerLabel={ownerLabel}
              ownerNodeId={ownerNodeId}
              scope={scope}
              selfKey={selfKey}
              session={session}
              triggerKinds={triggerKinds}
              onAfterClose={handleAfterClose}
              onClose={close}
              onSave={handleSave}
            />
          )}
    </div>
  );
};

interface RuleRowProps {
  ruleId: string;
  index: number;
  active: boolean;
  triggerSummary: string;
  actionsSummary: string;
  issueCount: number;
  issueSeverity: ValidationSeverity | undefined;
  onEdit: (ruleId: string) => void;
  onDuplicate: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onRegisterRow: (ruleId: string, node: HTMLDivElement | null) => void;
}

const RuleRowBase: FC<RuleRowProps> = ({
  actionsSummary,
  active,
  index,
  issueCount,
  issueSeverity,
  onDelete,
  onDuplicate,
  onEdit,
  onRegisterRow,
  ruleId,
  triggerSummary
}) => {
  const ruleNumber = index + 1;
  const rowRef = useCallback(
    (node: HTMLDivElement | null) => onRegisterRow(ruleId, node),
    [onRegisterRow, ruleId]
  );

  return (
    <DataListRow
      active={active}
      deleteAriaLabel={`删除规则 ${ruleNumber}`}
      duplicateAriaLabel={`复制规则 ${ruleNumber}`}
      editAriaLabel={`编辑规则 ${ruleNumber}`}
      rowRef={rowRef}
      primary={(
        <span css={dataListPrimaryLineCss}>
          <span css={ruleNumberBadgeCss}>{`规则 ${ruleNumber}`}</span>
          <span css={dataListNameCss} title={triggerSummary}>{triggerSummary}</span>
        </span>
      )}
      secondary={(
        <span css={dataListSecondaryLineCss}>
          <span css={dataListSummaryCss} title={actionsSummary}>{actionsSummary}</span>

          {issueCount > 0
            ? (
                <>
                  <span aria-hidden css={dataListMetaDotCss}>·</span>

                  <span
                    css={[ruleIssueBadgeCss, issueSeverity === "error" ? ruleIssueErrorCss : dataListWarningCss]}
                    data-has-issues="true"
                    data-issue-severity={issueSeverity}
                  >
                    <span aria-hidden css={ruleIssueIconCss}>
                      <EditorIcon name={issueSeverity === "error" ? "circle-x" : "triangle-alert"} />
                    </span>

                    <span>{`${issueCount} 项问题`}</span>
                  </span>
                </>
              )
            : null}
        </span>
      )}
      onDelete={() => onDelete(ruleId)}
      onDuplicate={() => onDuplicate(ruleId)}
      onEdit={() => onEdit(ruleId)}
    />
  );
};

/**
 * Memoized on primitive summary strings and stable callbacks so unrelated scope
 * changes, `$vars` updates, and edits to sibling rules never re-render untouched
 * rows.
 */
const RuleRow = memo(RuleRowBase);
