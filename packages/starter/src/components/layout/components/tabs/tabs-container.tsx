import type { Position } from "@vef-framework-react/components";
import type { MaybeUndefined } from "@vef-framework-react/shared";
import type { JSX } from "react";

import { css } from "@emotion/react";
import { globalCssVars, ScrollArea } from "@vef-framework-react/components";
import { clsx } from "@vef-framework-react/core";
import { useIsomorphicEffect } from "@vef-framework-react/hooks";
import { useCallback, useRef, useState } from "react";

import { TabList } from "./tab-list";

const tabsWrapperStyle = css({
  flex: "auto",
  "&.shadow-right::after": {
    content: "''",
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "10px",
    boxShadow: "inset -10px 0 8px -8px var(--vef-color-split)",
    transition: `box-shadow ${globalCssVars.motionDurationMid} ease`,
    pointerEvents: "none"
  },
  "&.shadow-left::before": {
    content: "''",
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "10px",
    boxShadow: "inset 10px 0 8px -8px var(--vef-color-split)",
    transition: `box-shadow ${globalCssVars.motionDurationMid} ease`,
    pointerEvents: "none"
  }
});

export function TabsContainer(): JSX.Element {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const isOverflowRef = useRef(false);
  const overflowWidthRef = useRef(0);
  const [rootClassName, setRootClassName] = useState<MaybeUndefined<string>>();

  useIsomorphicEffect(() => {
    const containerEl = tabsContainerRef.current;

    if (!containerEl) {
      return;
    }

    function updateOverflowState(): void {
      if (!containerEl) {
        return;
      }

      overflowWidthRef.current = containerEl.scrollWidth - containerEl.clientWidth;
      isOverflowRef.current = overflowWidthRef.current > 0;
      const { scrollLeft } = containerEl;

      setRootClassName(clsx({
        "shadow-left": scrollLeft > 0,
        "shadow-right": scrollLeft < overflowWidthRef.current
      }));
    }

    updateOverflowState();

    const resizeObserver = new ResizeObserver(() => {
      updateOverflowState();
    });

    resizeObserver.observe(containerEl);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleScrollPositionChange = useCallback(({ x }: Position) => {
    if (isOverflowRef.current) {
      setRootClassName(clsx({
        "shadow-left": x > 0,
        "shadow-right": x < overflowWidthRef.current
      }));
    }
  }, []);

  return (
    <ScrollArea
      className={rootClassName}
      css={tabsWrapperStyle}
      scrollbarPadding={1}
      scrollbarSize={5}
      type="scroll"
      viewportRef={tabsContainerRef}
      onScrollPositionChange={handleScrollPositionChange}
    >
      <TabList />
    </ScrollArea>
  );
}
