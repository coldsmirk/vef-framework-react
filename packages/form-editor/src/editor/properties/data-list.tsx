import type { ReactElement, ReactNode, Ref } from "react";

import { css } from "@emotion/react";
import { Button, globalCssVars } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";

/**
 * Shared compact-list chrome of the left sidebar's `数据` tab (form data sources
 * and form variables), so both lists share one visual rhythm, hover/focus
 * action reveal, keyboard model, and empty state.
 */

export const dataListWrapperCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

export const dataListSectionHeaderCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  paddingBottom: 6,
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

export const dataListSubHeaderCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
});

export const dataListTitleGroupCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0
});

export const dataListMainTitleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText
});

export const dataListSubtitleCss = css({
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 600,
  color: globalCssVars.colorTextSecondary
});

export const dataListCountBadgeCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 18,
  height: 18,
  padding: "0 5px",
  borderRadius: 999,
  background: globalCssVars.colorFillQuaternary,
  color: globalCssVars.colorTextSecondary,
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1
});

export const dataListAddHeaderButtonCss = css({
  flexShrink: 0,
  height: 24,
  padding: "0 6px",
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextSecondary,

  "&:hover": {
    color: globalCssVars.colorPrimaryText
  }
});

export const dataListItemsCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 2
});

export const dataListEmptyCss = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "16px 12px",
  border: `1px dashed ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorFillQuaternary,
  textAlign: "center"
});

export const dataListEmptyTitleCss = css({
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary
});

export const dataListEmptyHintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorTextTertiary
});

// Two-line compact row (≤ 52px): primary click area fills the row and opens the
// edit modal; duplicate/delete actions sit as siblings (never nested buttons)
// and reveal on hover or keyboard focus, reserving trailing padding so long
// labels ellipsize cleanly before the buttons.
const rowCss = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  borderRadius: 6,
  transition: `background-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover": {
    background: globalCssVars.colorFillTertiary
  },

  "&:hover [data-row-main], &:focus-within [data-row-main]": {
    paddingRight: 62
  },

  "&:hover [data-row-actions], &:focus-within [data-row-actions]": {
    opacity: 1
  },

  "@media (hover: none)": {
    "& [data-row-main]": {
      paddingRight: 62
    }
  }
});

// Active state uses a quiet primary wash (matching the outline tree), never an
// edge accent bar.
const rowActiveCss = css({
  background: globalCssVars.colorPrimaryBg,

  "&:hover": {
    background: globalCssVars.colorPrimaryBg
  }
});

const mainButtonCss = css({
  flex: 1,
  minWidth: 0,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "6px 8px",
  border: "none",
  borderRadius: 6,
  background: "transparent",
  textAlign: "left",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",

  "&:focus-visible": {
    outline: `2px solid ${globalCssVars.colorPrimaryBorder}`,
    outlineOffset: -2
  }
});

const actionsCss = css({
  position: "absolute",
  right: 6,
  top: "50%",
  transform: "translateY(-50%)",
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  opacity: 0,
  transition: `opacity ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "@media (hover: none)": {
    opacity: 1
  }
});

const actionButtonCss = css({
  width: 24,
  height: 24,
  padding: 0,
  color: globalCssVars.colorTextSecondary
});

export const dataListPrimaryLineCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  lineHeight: "20px"
});

export const dataListNameCss = css({
  flex: "0 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  color: globalCssVars.colorText
});

export const dataListUnnamedCss = css({
  fontWeight: 400,
  color: globalCssVars.colorTextTertiary
});

export const dataListSecondaryLineCss = css({
  display: "flex",
  alignItems: "center",
  gap: 5,
  minWidth: 0,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: "16px",
  color: globalCssVars.colorTextTertiary
});

export const dataListSummaryCss = css({
  flex: "0 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

export const dataListWarningCss = css({
  color: globalCssVars.colorWarningText
});

export const dataListMetaDotCss = css({
  flexShrink: 0,
  color: globalCssVars.colorTextQuaternary
});

export const dataListUsageCss = css({
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
  color: globalCssVars.colorTextQuaternary
});

export const dataListUsageActiveCss = css({
  color: globalCssVars.colorTextSecondary
});

export interface DataListSectionHeaderProps {
  title: string;
  titleLevel?: "main" | "sub";
  count: number;
  addLabel: string;
  onAdd: () => void;
}

/**
 * Header of a compact data list. The add button sits beside the title, so it
 * stays in reach above a long list.
 */
export function DataListSectionHeader({
  addLabel,
  count,
  onAdd,
  title,
  titleLevel = "main"
}: DataListSectionHeaderProps): ReactElement {
  return (
    <div css={titleLevel === "main" ? dataListSectionHeaderCss : dataListSubHeaderCss}>
      <div css={dataListTitleGroupCss}>
        <span css={titleLevel === "main" ? dataListMainTitleCss : dataListSubtitleCss}>{title}</span>
        {count > 0 ? <span css={dataListCountBadgeCss}>{count}</span> : null}
      </div>

      <Button
        aria-label={addLabel}
        css={dataListAddHeaderButtonCss}
        icon={<EditorIcon name="plus" />}
        size="small"
        type="text"
        onClick={onAdd}
      >
        新增
      </Button>
    </div>
  );
}

export interface DataListRowProps {
  rowRef?: Ref<HTMLDivElement>;
  active?: boolean;
  editAriaLabel: string;
  duplicateAriaLabel: string;
  deleteAriaLabel: string;
  primary: ReactNode;
  secondary: ReactNode;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * Accessible two-line compact row shared by data sources and form variables.
 * Clicking (or pressing Enter / Space on) the row opens its edit modal;
 * duplicate and delete buttons live as focusable siblings revealed on hover or
 * `:focus-within`.
 */
export function DataListRow({
  active = false,
  deleteAriaLabel,
  duplicateAriaLabel,
  editAriaLabel,
  onDelete,
  onDuplicate,
  onEdit,
  primary,
  rowRef,
  secondary
}: DataListRowProps): ReactElement {
  return (
    <div
      ref={rowRef}
      css={[rowCss, active && rowActiveCss]}
      data-active={active ? "true" : undefined}
      role="listitem"
    >
      <button
        aria-label={editAriaLabel}
        css={mainButtonCss}
        data-row-main=""
        type="button"
        onClick={onEdit}
      >
        {primary}
        {secondary}
      </button>

      <div css={actionsCss} data-row-actions="">
        <Button
          aria-label={duplicateAriaLabel}
          css={actionButtonCss}
          icon={<EditorIcon name="copy" />}
          size="small"
          title="复制"
          type="text"
          onClick={onDuplicate}
        />

        <Button
          danger
          aria-label={deleteAriaLabel}
          css={actionButtonCss}
          icon={<EditorIcon name="trash-2" />}
          size="small"
          title="删除"
          type="text"
          onClick={onDelete}
        />
      </div>
    </div>
  );
}

export function DataListEmpty({ hint, title }: { title: string; hint: string }): ReactElement {
  return (
    <div css={dataListEmptyCss}>
      <span css={dataListEmptyTitleCss}>{title}</span>
      <span css={dataListEmptyHintCss}>{hint}</span>
    </div>
  );
}
