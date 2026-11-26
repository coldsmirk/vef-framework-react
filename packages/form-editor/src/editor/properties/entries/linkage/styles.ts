import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

export const rootCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 14
});

// The rule-list editor's own vertical stack — the rules / empty state above its
// "add rule" button. Self-contained so the spacing holds wherever it is mounted
// (the form-level events panel renders it bare, with no wrapping layout).
export const ruleListRootCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 14
});

export const headerCss = css({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12
});

export const titleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText
});

export const hintCss = css({
  marginTop: 4,
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.5
});

export const defaultStatesCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

export const defaultStateCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "12px 14px",
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorFillQuaternary
});

export const defaultTextCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0
});

export const defaultTitleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  color: globalCssVars.colorText
});

export const defaultHintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

export const expressionHeaderLabelCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

export const emptyCss = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 112,
  padding: 18,
  border: `1px dashed ${globalCssVars.colorBorder}`,
  borderRadius: globalCssVars.borderRadius,
  color: globalCssVars.colorTextTertiary,
  textAlign: "center",
  fontSize: globalCssVars.fontSize,
  lineHeight: 1.5
});

// The "add disabled" empty state (no field in scope to build a rule from): a
// warning tone (paired with a triangle-alert glyph) so it reads as blocked,
// not as an ordinary empty list awaiting a first rule.
export const emptyBlockedCss = css({
  color: globalCssVars.colorWarningText
});

export const sectionCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

export const sectionLabelCss = css({
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 2,
  color: globalCssVars.colorTextTertiary
});

export const conditionGroupCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorFillQuaternary,
  containerType: "inline-size"
});

export const conditionGroupHeaderCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
});

export const conditionRowCss = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(118px, 0.45fr) auto",
  gap: 8,
  alignItems: "center"
});

export const conditionRowWithValueCss = css({
  "@container (min-width: 560px)": {
    gridTemplateColumns: "minmax(0, 1fr) 136px minmax(0, 1fr) auto"
  }
});

export const conditionValueCss = css({
  gridColumn: "1 / -1",
  gridRow: 2,

  "@container (min-width: 560px)": {
    gridColumn: "auto",
    gridRow: "auto"
  }
});

export const conditionRowDeleteCss = css({
  gridColumn: 3,
  gridRow: 1,
  width: 32,
  height: 32,
  padding: 0,

  "@container (min-width: 560px)": {
    gridColumn: "auto",
    gridRow: "auto"
  }
});

export const conditionExpressionRowCss = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "start"
});

export const addRowCss = css({
  display: "flex",
  gap: 8,
  flexWrap: "wrap"
});

export const addInlineButtonCss = css({
  height: 32,
  borderStyle: "dashed"
});

export const addButtonCss = css({
  borderStyle: "dashed",
  fontSize: globalCssVars.fontSize
});

export const codeEditorWrapperCss = css({
  display: "flex",
  flexDirection: "column",
  minWidth: 0
});

// Inline notice inside the condition builder (e.g. "no field to seed the
// visual mode with") — informational, not a validation issue.
export const conditionNoticeCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorWarningText,
  lineHeight: 1.5
});

export const triggerHintCss = css({
  padding: "8px 10px",
  border: `1px dashed ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorFillQuaternary,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.5
});

export const actionRetriggerCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  paddingTop: 2
});

export const actionRetriggerLabelCss = css({
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  color: globalCssVars.colorText
});

export const actionsListCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 10
});

export const actionCardCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorFillQuaternary
});

export const actionDeleteCss = css({
  width: 32,
  height: 32,
  padding: 0,
  flexShrink: 0
});

export const valueEditorCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6
});

export const selectStyle = { width: "100%" } as const;
