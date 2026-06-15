import type { FC } from "react";

import { css, keyframes } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { Panel, useReactFlow, useStore } from "@xyflow/react";
import { Maximize2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];

/* -- Animations ------------------------------------------------------------ */

const fadeIn = keyframes({
  from: { opacity: 0, transform: "translateX(-50%) translateY(4px)" },
  to: { opacity: 1, transform: "translateX(-50%) translateY(0)" }
});

/* -- Styles ---------------------------------------------------------------- */

const wrapperStyle = css({
  position: "relative"
});

const barStyle = css({
  display: "flex",
  alignItems: "center",
  gap: 2,
  padding: globalCssVars.spacingXxs,
  background: globalCssVars.colorBgContainer,
  borderRadius: globalCssVars.borderRadiusLg,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  boxShadow: `0 2px 8px ${globalCssVars.colorFillContent}`,
  userSelect: "none"
});

const iconBtnStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  color: globalCssVars.colorTextTertiary,
  cursor: "pointer",
  flexShrink: 0,
  transition: `background ${globalCssVars.motionDurationMid}, color ${globalCssVars.motionDurationMid}`,

  "&:hover": {
    background: globalCssVars.colorFillQuaternary,
    color: globalCssVars.colorText
  },

  "&:active": {
    background: globalCssVars.colorFillTertiary
  }
});

const percentButtonStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: 28,
  minWidth: 48,
  padding: "0 4px",
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  color: globalCssVars.colorText,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
  transition: `background ${globalCssVars.motionDurationMid}`,

  "&:hover": {
    background: globalCssVars.colorFillQuaternary
  }
});

const separatorStyle = css({
  width: 1,
  height: 16,
  background: globalCssVars.colorBorderSecondary,
  flexShrink: 0
});

/* -- Dropdown -------------------------------------------------------------- */

const dropdownStyle = css({
  position: "absolute",
  bottom: "calc(100% + 6px)",
  left: "50%",
  transform: "translateX(-50%)",
  minWidth: 108,
  padding: 4,
  background: globalCssVars.colorBgContainer,
  borderRadius: globalCssVars.borderRadiusLg,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  boxShadow: `0 6px 20px ${globalCssVars.colorFillContent}`,
  zIndex: 10,
  animation: `${fadeIn} ${globalCssVars.motionDurationMid} ease-out`
});

const dropdownItemStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: 30,
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  color: globalCssVars.colorText,
  cursor: "pointer",
  fontSize: globalCssVars.fontSize,
  fontVariantNumeric: "tabular-nums",
  transition: `background ${globalCssVars.motionDurationMid}`,

  "&:hover": {
    background: globalCssVars.colorFillQuaternary
  },

  "&[data-active]": {
    color: globalCssVars.colorPrimary,
    fontWeight: 600
  }
});

const dropdownDividerStyle = css({
  height: 1,
  background: globalCssVars.colorBorderSecondary,
  margin: `${globalCssVars.spacingXxs} ${globalCssVars.spacingXs}`
});

const fitViewItemStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  height: 30,
  borderRadius: globalCssVars.borderRadius,
  border: "none",
  background: "transparent",
  color: globalCssVars.colorTextSecondary,
  cursor: "pointer",
  fontSize: globalCssVars.fontSize,
  transition: `background ${globalCssVars.motionDurationMid}, color ${globalCssVars.motionDurationMid}`,

  "&:hover": {
    background: globalCssVars.colorFillQuaternary,
    color: globalCssVars.colorText
  }
});

/* -- Component ------------------------------------------------------------- */

export const ZoomControl: FC = () => {
  const {
    zoomIn,
    zoomOut,
    zoomTo,
    fitView
  } = useReactFlow();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Subscribe only to the rounded zoom percentage (transform[2] is zoom), so the
  // control does not re-render on every pan frame the way useViewport (x/y/zoom)
  // would.
  const percent = useStore(s => Math.round(s.transform[2] * 100));

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !(event.target instanceof Node && wrapperRef.current.contains(event.target))) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectPreset = (value: number) => {
    zoomTo(value / 100, { duration: 200 });
    setOpen(false);
  };

  const handleFitView = () => {
    fitView({ padding: 0.2, duration: 300 });
    setOpen(false);
  };

  return (
    <Panel position="bottom-left">
      <div ref={wrapperRef} css={wrapperStyle}>
        {open && (
          <div css={dropdownStyle}>
            {ZOOM_PRESETS.map(p => (
              <button
                key={p}
                css={dropdownItemStyle}
                data-active={percent === p || undefined}
                type="button"
                onClick={() => selectPreset(p)}
              >
                {p}
                %
              </button>
            ))}

            <div css={dropdownDividerStyle} />

            <button css={fitViewItemStyle} type="button" onClick={handleFitView}>
              <Maximize2Icon height={13} width={13} />
              适配画布
            </button>
          </div>
        )}

        <div css={barStyle}>
          <button
            aria-label="缩小"
            css={iconBtnStyle}
            title="缩小"
            type="button"
            onClick={() => zoomOut({ duration: 200 })}
          >
            <ZoomOutIcon size={16} />
          </button>

          <button
            aria-expanded={open}
            aria-label="选择缩放比例"
            css={percentButtonStyle}
            title="选择缩放比例"
            type="button"
            onClick={() => setOpen(prev => !prev)}
          >
            {percent}
            %
          </button>

          <button
            aria-label="放大"
            css={iconBtnStyle}
            title="放大"
            type="button"
            onClick={() => zoomIn({ duration: 200 })}
          >
            <ZoomInIcon size={16} />
          </button>

          <div css={separatorStyle} />

          <button
            aria-label="适配画布"
            css={iconBtnStyle}
            title="适配画布"
            type="button"
            onClick={() => fitView({ padding: 0.2, duration: 300 })}
          >
            <Maximize2Icon size={14} />
          </button>
        </div>
      </div>
    </Panel>
  );
};
