import type { ReactElement, ReactNode } from "react";

import { css } from "@emotion/react";
import { Button, globalCssVars } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";

const headerCss = css({
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "18px 20px 16px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  flexShrink: 0
});

const iconCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  borderRadius: 8,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  color: globalCssVars.colorTextSecondary,
  flexShrink: 0,

  "& > svg": {
    width: 20,
    height: 20
  }
});

const bodyCss = css({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  gap: 4
});

const titleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText,
  lineHeight: 1.3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const subtitleCss = css({
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorTextTertiary,
  fontFamily: globalCssVars.fontFamilyCode,
  letterSpacing: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const closeButtonCss = css({
  width: 32,
  height: 32,
  padding: 0,
  flexShrink: 0,

  "& svg": {
    width: 16,
    height: 16
  }
});

export interface PanelHeaderProps {
  /**
   * Icon node shown in the bordered box — a `DynamicIcon` or an `<img>`. The box
   * sizes an `svg` child to 20×20; an image supplies its own sizing.
   */
  icon: ReactNode;
  title: string;
  /**
   * Optional monospace subtitle (a node id / key), truncated with ellipsis and
   * shown in full on hover.
   */
  subtitle?: string;
  onClose: () => void;
}

/**
 * Shared chrome for a properties-panel header: a bordered icon box, a title with
 * an optional monospace subtitle, and a deselect button. Used by the field and
 * container property panels so the header layout lives in one place.
 */
export function PanelHeader({
  icon,
  onClose,
  subtitle,
  title
}: PanelHeaderProps): ReactElement {
  return (
    <div css={headerCss}>
      <span css={iconCss}>{icon}</span>

      <div css={bodyCss}>
        <span css={titleCss}>{title}</span>
        {subtitle === undefined ? null : <span css={subtitleCss} title={subtitle}>{subtitle}</span>}
      </div>

      <Button
        aria-label="取消选择"
        css={closeButtonCss}
        icon={<EditorIcon name="x" />}
        title="取消选择"
        type="text"
        onClick={onClose}
      />
    </div>
  );
}
