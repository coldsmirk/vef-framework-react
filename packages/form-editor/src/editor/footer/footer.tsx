import type { ReactElement } from "react";

import type { FormConfigTabId } from "../../store/form-store";

import { css } from "@emotion/react";
import { globalCssVars, Tooltip } from "@vef-framework-react/components";

import { hasErrorIssues } from "../../engine/validation";
import { EditorIcon } from "../../icons";
import { selectFieldCount, selectLinkageRuleCount, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
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
  borderRadius: globalCssVars.borderRadiusSm,
  whiteSpace: "nowrap",
  flexShrink: 0,
  fontSize: globalCssVars.fontSizeSm,
  cursor: "default",

  "& svg": { width: 13, height: 13 }
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

const spacerCss = css({ flex: 1 });

const toggleCss = css([
  pillCss,
  {
    gap: 6,
    fontWeight: 500
  }
]);

const activeFillCss = css({
  // A neutral fill marks an active footer control — a count pill whose tab the
  // open drawer is showing, and the drawer toggle itself — keeping the saturated
  // accent for the publish CTA only (matching the toolbar's demoted toggle).
  background: globalCssVars.colorFillSecondary,
  color: globalCssVars.colorText,

  "&:hover": {
    background: globalCssVars.colorFillSecondary,
    color: globalCssVars.colorText
  }
});

interface CountPill {
  label: string;
  count: number;
  tab: FormConfigTabId;
}

/**
 * Bottom status bar. Count pills double as shortcuts into the form-config
 * drawer's matching tab; the right-hand toggle expands / collapses the drawer.
 * Rendered only in edit mode by the shell, so it mirrors the design surface.
 */
export function EditorFooter(): ReactElement {
  // Primitive selectors so a keystroke that touches neither declarations nor
  // rules re-renders nothing here.
  const fieldsCount = useFormEditorStore(selectFieldCount);
  const variablesCount = useFormEditorStore(s => s.schema.variables?.length ?? 0);
  const dataSourcesCount = useFormEditorStore(s => s.schema.dataSources?.length ?? 0);
  const linkageCount = useFormEditorStore(selectLinkageRuleCount);
  const drawerOpen = useFormEditorStore(s => s.formConfigOpen);
  // Tracks which tab the open drawer shows, so the matching count pill can read
  // as active (a discrete change — re-renders the footer only on tab switches).
  const activeTab = useFormEditorStore(s => s.formConfigTab);
  const storeApi = useFormEditorStoreApi();
  const issues = useSchemaIssues();
  const hasErrors = hasErrorIssues(issues);

  const pills: CountPill[] = [
    {
      label: "字段",
      count: fieldsCount,
      tab: "outline"
    },
    {
      label: "变量",
      count: variablesCount,
      tab: "variables"
    },
    {
      label: "数据源",
      count: dataSourcesCount,
      tab: "dataSources"
    },
    {
      // Field-level rules plus form-level events — the aggregate the designer
      // actually authored; the drawer tab edits the form-level share.
      label: "联动",
      count: linkageCount,
      tab: "linkage"
    }
  ];

  return (
    <footer css={footerCss}>
      {pills.map(pill => (
        <button
          key={pill.tab}
          css={[pillCss, drawerOpen && activeTab === pill.tab && activeFillCss]}
          type="button"
          onClick={() => storeApi.getState().setFormConfigTab(pill.tab)}
        >
          <span css={countCss}>{pill.count}</span>
          <span>{pill.label}</span>
        </button>
      ))}

      {issues.length > 0
        ? (
            <Tooltip title={<IssueList issues={issues} />}>
              <span css={[issuesChipCss, hasErrors ? issuesErrorCss : issuesWarningCss]} data-testid="footer-issues">
                <EditorIcon name={hasErrors ? "circle-alert" : "triangle-alert"} />

                <span>
                  {issues.length}
                  {" "}
                  {hasErrors ? "项问题" : "项提示"}
                </span>
              </span>
            </Tooltip>
          )
        : null}

      <span css={spacerCss} />

      <button
        css={[toggleCss, drawerOpen && activeFillCss]}
        type="button"
        onClick={() => storeApi.getState().setFormConfigOpen(!drawerOpen)}
      >
        <EditorIcon name={drawerOpen ? "chevron-down" : "chevron-up"} />
        <span>表单配置</span>
      </button>
    </footer>
  );
}
