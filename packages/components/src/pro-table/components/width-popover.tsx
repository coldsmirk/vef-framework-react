import type { ReactNode } from "react";

import { css } from "@emotion/react";
import { throttle } from "@vef-framework-react/shared";
import { memo, useCallback, useMemo, useState } from "react";

import { globalCssVars } from "../../_base";
import { Popover } from "../../popover";
import { Slider } from "../../slider";
import { Stack } from "../../stack";

interface WidthPopoverProps {
  currentWidth?: number;
  disabled?: boolean;
  children: ReactNode;
  onWidthChange: (width: number) => void;
}

const contentStyle = css({ width: 180 });
const labelStyle = css({ color: globalCssVars.colorTextSecondary });
const valueStyle = css({
  color: globalCssVars.colorPrimaryText,
  fontFamily: globalCssVars.fontFamilyCode,
  fontWeight: 500
});
const sliderStyle = css({ margin: 0 });

const MIN_WIDTH = 60;
const MAX_WIDTH = 600;
const STEP = 10;
const DEFAULT_WIDTH = 120;

export const WidthPopover = memo<WidthPopoverProps>(({
  currentWidth,
  disabled,
  children,
  onWidthChange
}) => {
  const [open, setOpen] = useState(false);
  const [localWidth, setLocalWidth] = useState(currentWidth ?? DEFAULT_WIDTH);

  const throttledOnWidthChange = useMemo(
    () => throttle({ interval: 100 }, onWidthChange),
    [onWidthChange]
  );

  const handleOpenChange = useCallback((visible: boolean) => {
    if (disabled) {
      return;
    }

    setOpen(visible);

    if (visible) {
      setLocalWidth(currentWidth ?? DEFAULT_WIDTH);
    } else {
      throttledOnWidthChange.trigger(localWidth);
    }
  }, [currentWidth, disabled, localWidth, throttledOnWidthChange]);

  const handleSliderChange = useCallback((value: number) => {
    setLocalWidth(value);
    throttledOnWidthChange(value);
  }, [throttledOnWidthChange]);

  return (
    <Popover
      open={open}
      placement="bottomRight"
      trigger="click"
      content={(
        <Stack css={contentStyle} gap="var(--vef-spacing-sm)">
          <div css={labelStyle}>
            当前列宽:
            {" "}

            <span css={valueStyle}>
              {localWidth}
              px
            </span>
          </div>

          <Slider
            css={sliderStyle}
            max={MAX_WIDTH}
            min={MIN_WIDTH}
            step={STEP}
            tooltip={{ formatter: value => `${value}px` }}
            value={localWidth}
            onChange={handleSliderChange}
          />
        </Stack>
      )}
      onOpenChange={handleOpenChange}
    >
      {children}
    </Popover>
  );
});

WidthPopover.displayName = "WidthPopover";
