import type { Awaitable } from "@vef-framework-react/shared";
import type { JSX } from "react";

import type { AppItem } from "../../props";

import { css } from "@emotion/react";
import { globalCssVars, IconButton, Popover, ScrollArea } from "@vef-framework-react/components";
import { LayoutGridIcon } from "lucide-react";
import { useState } from "react";

interface AppSwitcherProps {
  apps: AppItem[];
  currentAppId?: string;
  onAppChange?: (appId: string) => Awaitable<void>;
  className?: string;
}

const scrollAreaStyle = css({
  width: "420px",
  maxWidth: "calc(100vw - 32px)"
});

// Cap the viewport (not the ScrollArea root) so it scrolls rather than clips, then a responsive
// grid keeps a dozen-plus apps on screen instead of one tall column.
const viewportStyle = { maxHeight: "min(480px, 64vh)" };

const gridStyle = css({
  display: "grid",
  width: "100%",
  gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))",
  gap: globalCssVars.spacingSm
});

const appItemStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  rowGap: globalCssVars.spacingSm,
  paddingBlock: globalCssVars.spacingMd,
  paddingInline: globalCssVars.spacingSm,
  border: "none",
  borderRadius: globalCssVars.borderRadiusLg,
  background: "transparent",
  color: globalCssVars.colorText,
  cursor: "pointer",
  fontSize: globalCssVars.fontSize,
  transition: `background-color ${globalCssVars.motionDurationMid}`,

  "&:hover": {
    backgroundColor: globalCssVars.colorFillTertiary,

    "& [data-app-icon]": {
      backgroundColor: globalCssVars.colorFillSecondary
    }
  },
  "&[data-active='true']": {
    backgroundColor: globalCssVars.colorPrimaryBg,
    color: globalCssVars.colorPrimary,

    // Fill the active tile's icon chip solid, with a soft brand glow for depth.
    "& [data-app-icon]": {
      backgroundColor: globalCssVars.colorPrimary,
      color: "var(--vef-color-white)",
      boxShadow: "0 6px 16px -6px color-mix(in srgb, var(--vef-color-primary) 45%, transparent)"
    }
  }
});

const appIconStyle = css({
  display: "flex",
  flex: "none",
  alignItems: "center",
  justifyContent: "center",
  width: "56px",
  height: "56px",
  overflow: "hidden",
  borderRadius: globalCssVars.borderRadiusLg,
  backgroundColor: globalCssVars.colorFillTertiary,
  color: globalCssVars.colorTextSecondary,
  fontSize: "26px",
  transition: `background-color ${globalCssVars.motionDurationMid}, color ${globalCssVars.motionDurationMid}, box-shadow ${globalCssVars.motionDurationMid}`,

  // The consumer may hand us an `<img>` (e.g. an uploaded app icon) instead of a
  // glyph node; make it fill the chip and let `overflow: hidden` clip the corners.
  "& img": {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  }
});

const appNameStyle = css({
  display: "-webkit-box",
  maxWidth: "100%",
  overflow: "hidden",
  fontSize: globalCssVars.fontSize,
  lineHeight: 1.4,
  textAlign: "center",
  wordBreak: "break-word",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2
});

export function AppSwitcher({
  apps,
  currentAppId,
  onAppChange,
  className
}: AppSwitcherProps): JSX.Element {
  const [open, setOpen] = useState(false);

  async function handleSelect(appId: string): Promise<void> {
    setOpen(false);

    if (appId !== currentAppId) {
      await onAppChange?.(appId);
    }
  }

  const content = (
    <ScrollArea
      css={scrollAreaStyle}
      scrollbarSize={8}
      type="scroll"
      viewportStyle={viewportStyle}
    >
      <div css={gridStyle}>
        {apps.map(app => (
          <button
            key={app.id}
            css={appItemStyle}
            data-active={app.id === currentAppId}
            title={app.description}
            type="button"
            onClick={() => handleSelect(app.id)}
          >
            {app.icon
              ? (
                  <span data-app-icon css={appIconStyle}>
                    {app.icon}
                  </span>
                )
              : null}

            <span css={appNameStyle}>{app.name}</span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );

  return (
    <Popover
      content={content}
      open={open}
      placement="bottomLeft"
      trigger="click"
      onOpenChange={setOpen}
    >
      <IconButton
        className={className}
        icon={<LayoutGridIcon />}
        size="large"
        tip={open ? undefined : "切换应用"}
      />
    </Popover>
  );
}
