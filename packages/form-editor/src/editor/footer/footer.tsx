import type { ReactElement } from "react";

import type { SchemaIssue } from "../../engine/validation";

import { css } from "@emotion/react";
import { globalCssVars, Popover } from "@vef-framework-react/components";
import { useState } from "react";

import { hasErrorIssues } from "../../engine/validation";
import { EditorIcon } from "../../icons";
import { selectFieldCount, selectLinkageRuleCount, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { useIssueDescriber, useIssueNavigator } from "../issue-location";
import { IssueList, useSchemaIssues } from "../validation-summary";

const footerCss = css({
  display: "flex",
  alignItems: "center",
  gap: globalCssVars.spacingXs,
  height: 32,
  flexShrink: 0,
  padding: `0 ${globalCssVars.spacingMd}`,
  background: globalCssVars.colorBgContainer,
  borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextSecondary
});

const pillCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 9px",
  borderRadius: globalCssVars.borderRadiusSm,
  border: "none",
  background: "transparent",
  color: globalCssVars.colorTextSecondary,
  fontSize: globalCssVars.fontSizeSm,
  cursor: "pointer",
  // Labels must never wrap: a narrow host would otherwise stack the glyphs of
  // "数据源" vertically and the bar turns to soup.
  whiteSpace: "nowrap",
  flexShrink: 0,
  transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover": {
    background: globalCssVars.colorFillTertiary,
    color: globalCssVars.colorText
  }
});

const issuesChipCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 9px",
  border: "none",
  borderRadius: globalCssVars.borderRadiusSm,
  whiteSpace: "nowrap",
  flexShrink: 0,
  fontSize: globalCssVars.fontSizeSm,
  cursor: "pointer",

  "& svg": { width: 13, height: 13 },

  "&:focus-visible": {
    outline: `2px solid ${globalCssVars.colorPrimaryBorder}`,
    outlineOffset: 1
  }
});

const issuesPanelCss = css({
  width: 360,
  maxWidth: "calc(100vw - 48px)"
});

// Warning-only issues read as a soft amber hint; any error-severity issue (a
// linkage cycle, a duplicate key — the codes the publish gate blocks on) flips
// the chip to the error surface so it never disguises a blocker as a hint. Both
// use the semantic surface/text token pair (the same one the properties-panel
// warning banner wears), which is contrast-tuned for small text and already
// dark-mode-correct — no hand-rolled tint.
const issuesWarningCss = css({
  color: globalCssVars.colorWarningText,
  background: globalCssVars.colorWarningBg
});

const issuesErrorCss = css({
  color: globalCssVars.colorErrorText,
  background: globalCssVars.colorErrorBg
});

const countCss = css({
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
  color: globalCssVars.colorText
});

interface CountPill {
  id: string;
  label: string;
  count: number;
  onClick: () => void;
}

/**
 * Bottom status bar. Count pills jump straight to the side-panel tab owning
 * each inventory (`字段` → left `大纲`, `变量` / `数据源` → left `数据`,
 * `联动` → right `表单`); the diagnostics chip opens the full issue list.
 * Rendered only in edit mode by the stage, so it mirrors the design surface.
 */
export function EditorFooter(): ReactElement {
  // Primitive / WeakMap-memoized selectors so a keystroke that touches neither
  // declarations nor rules re-renders nothing here.
  const fieldsCount = useFormEditorStore(selectFieldCount);
  const variablesCount = useFormEditorStore(s => s.schema.variables?.length ?? 0);
  const dataSourcesCount = useFormEditorStore(s => s.schema.dataSources?.length ?? 0);
  const linkageCount = useFormEditorStore(selectLinkageRuleCount);
  const storeApi = useFormEditorStoreApi();

  const pills: CountPill[] = [
    {
      id: "fields",
      label: "字段",
      count: fieldsCount,
      onClick: () => storeApi.getState().setSidebarTab("outline")
    },
    {
      id: "variables",
      label: "变量",
      count: variablesCount,
      onClick: () => storeApi.getState().setSidebarTab("data")
    },
    {
      id: "dataSources",
      label: "数据源",
      count: dataSourcesCount,
      onClick: () => storeApi.getState().setSidebarTab("data")
    },
    {
      // Field-level rules plus form-level events — the aggregate the designer
      // actually authored; the right `表单` tab lists field linkages and edits
      // form-level events.
      id: "linkage",
      label: "联动",
      count: linkageCount,
      onClick: () => storeApi.getState().setPropertiesTab("form")
    }
  ];

  return (
    <footer css={footerCss}>
      {pills.map(pill => (
        <button
          key={pill.id}
          css={pillCss}
          type="button"
          onClick={pill.onClick}
        >
          <span css={countCss}>{pill.count}</span>
          <span>{pill.label}</span>
        </button>
      ))}

      <IssuesChip />
    </footer>
  );
}

/**
 * The schema's diagnostics — structural and the host's — behind one chip. It
 * opens the full list, where each locatable issue takes the designer to the
 * node or side-panel tab it is about. Renders nothing while the schema is
 * clean, so a clean form keeps a quiet footer.
 */
function IssuesChip(): ReactElement | null {
  const issues = useSchemaIssues();
  const resolveIssue = useIssueNavigator();
  const describeLocation = useIssueDescriber();
  const [open, setOpen] = useState(false);

  if (issues.length === 0) {
    return null;
  }

  const hasErrors = hasErrorIssues(issues);
  const summary = `${issues.length} ${hasErrors ? "项问题" : "项提示"}`;

  // Showing an issue moves the designer's focus to it, so the list gets out
  // of the way.
  const resolveAction = (issue: SchemaIssue): (() => void) | undefined => {
    const show = resolveIssue(issue);

    return show === undefined
      ? undefined
      : () => {
          setOpen(false);
          show();
        };
  };

  return (
    <Popover
      arrow={false}
      open={open}
      placement="topLeft"
      title={summary}
      trigger="click"
      content={(
        <div css={issuesPanelCss}>
          <IssueList describeLocation={describeLocation} issues={issues} resolveAction={resolveAction} />
        </div>
      )}
      onOpenChange={setOpen}
    >
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        css={[issuesChipCss, hasErrors ? issuesErrorCss : issuesWarningCss]}
        data-testid="footer-issues"
        type="button"
      >
        <EditorIcon name={hasErrors ? "circle-alert" : "triangle-alert"} />
        <span>{summary}</span>
      </button>
    </Popover>
  );
}
