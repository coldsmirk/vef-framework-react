import type { ComponentProps, ReactNode } from "react";

import { css } from "@emotion/react";
import { globalCssVars, IconButton } from "@vef-framework-react/components";
import { motion, useSortable } from "@vef-framework-react/core";
import { useMergedRef } from "@vef-framework-react/hooks";
import { XIcon } from "lucide-react";

interface TabItemProps extends ComponentProps<typeof motion.div> {
  index: number;
  tabId: string;
  label: ReactNode;
  onClose?: () => void;
}

const tabItemStyle = css({
  flex: "none",
  height: "calc(100% - 12px)",
  display: "flex",
  alignItems: "center",
  columnGap: "2px",
  paddingInline: globalCssVars.spacingSm,
  borderRadius: globalCssVars.borderRadius,
  cursor: "pointer",
  userSelect: "none",
  backgroundColor: "transparent",
  color: globalCssVars.colorTextSecondary,
  fontSize: globalCssVars.fontSize,
  transitionDuration: globalCssVars.motionDurationMid,
  transitionProperty: "color, background-color",
  transitionTimingFunction: "ease",

  "& .close-btn": {
    opacity: 0,
    transition: `opacity ${globalCssVars.motionDurationFast} ease`
  },

  "&:hover": {
    color: globalCssVars.colorText,
    backgroundColor: globalCssVars.colorFillTertiary,

    "& .close-btn": {
      opacity: 0.5
    },

    "& .vef-btn-sm": {
      "--vef-btn-text-color": globalCssVars.colorTextTertiary,
      "--vef-btn-text-color-hover": globalCssVars.colorTextSecondary,
      "--vef-btn-text-color-active": globalCssVars.colorTextSecondary
    }
  },

  // Active = a filled soft-brand pill. The app's selection language is filled, not outlined
  // (solid blue in the sidebar, translucent pill in the header), so the tint alone carries the
  // state — no outline ring, which previously read as a foreign control dropped into the row.
  "&.active": {
    color: globalCssVars.colorPrimaryText,
    backgroundColor: globalCssVars.colorPrimaryBg,
    fontWeight: 500,

    "& .close-btn": {
      opacity: 0.6
    },

    "& .vef-btn-sm": {
      "--vef-btn-text-color": globalCssVars.colorPrimaryText,
      "--vef-btn-text-color-hover": globalCssVars.colorPrimaryHover,
      "--vef-btn-text-color-active": globalCssVars.colorPrimaryActive
    }
  }
});

const closeIconStyle = css({
  "&.vef-btn-sm": {
    "--vef-control-height-sm": "18px",
    "--vef-button-content-font-size-sm": "11px"
  }
});

export function TabItem({
  ref,
  index,
  tabId,
  label,
  onClose,
  ...props
}: TabItemProps) {
  const { ref: sortableRef } = useSortable({
    id: tabId,
    index
  });
  const mergedRef = useMergedRef<HTMLDivElement>(sortableRef, ref);

  return (
    <motion.div
      ref={mergedRef}
      css={tabItemStyle}
      {...props}
    >
      <span>{label}</span>

      <IconButton
        className="close-btn"
        css={closeIconStyle}
        icon={<XIcon />}
        shape="round"
        size="small"
        onClick={event => {
          event.stopPropagation();
          onClose?.();
        }}
      />
    </motion.div>
  );
}
