import type { Transition, Variants } from "@vef-framework-react/core";
import type { CSSProperties } from "react";

import type { PageProps } from "./props";

import { motion } from "@vef-framework-react/core";
import { useMemo, useRef } from "react";

import { getSpacingValue, globalCssVars } from "../_base";
import { AsidePanel, ScrollContent } from "./components";
import { createPageEntranceController, PageEntranceContext } from "./entrance";
import { usePageKey } from "./hooks";
import * as styles from "./styles";

// Entrance rides translate + opacity, deliberately NOT scale: a scale
// transform distorts every getBoundingClientRect() in the subtree while it
// runs, so transform-sensitive content mounted mid-entrance (canvas editors,
// charts, popover anchoring) would bake the scale error into its cached
// geometry. A pure translation cancels out of relative measurements, keeping
// the entrance and in-page measurement orthogonal.
const pageVariants: Variants = {
  initial: { y: 12, opacity: 0 },
  animate: { y: 0, opacity: 1 }
};

const pageTransition: Transition = {
  duration: 0.6,
  ease: [0.25, 0.1, 0.25, 1]
};

function buildGridStyle(options: {
  hasLeft: boolean;
  hasRight: boolean;
  isHeaderOutside: boolean;
  isFooterOutside: boolean;
}): CSSProperties {
  const {
    hasLeft,
    hasRight,
    isHeaderOutside,
    isFooterOutside
  } = options;

  // Build column names
  const colNames: string[] = [];

  if (hasLeft) {
    colNames.push("left");
  }

  colNames.push("main");

  if (hasRight) {
    colNames.push("right");
  }

  // Build columns definition
  const colDefs: string[] = [];

  if (hasLeft) {
    colDefs.push("auto");
  }

  colDefs.push("1fr");

  if (hasRight) {
    colDefs.push("auto");
  }

  // Build rows and areas
  const rows: string[] = [];
  const areas: string[] = [];

  if (isHeaderOutside) {
    rows.push("auto");
    areas.push(`"${colNames.map(() => "header").join(" ")}"`);
  }

  rows.push("1fr");
  areas.push(`"${colNames.join(" ")}"`);

  if (isFooterOutside) {
    rows.push("auto");
    areas.push(`"${colNames.map(() => "footer").join(" ")}"`);
  }

  return {
    "--vef-page-grid-columns": colDefs.join(" "),
    "--vef-page-grid-rows": rows.join(" "),
    "--vef-page-grid-areas": areas.join(" ")
  } as CSSProperties;
}

export function Page({
  className,
  mainClassName,
  leftAside,
  leftAsideClassName,
  leftAsideWidth,
  rightAside,
  rightAsideClassName,
  rightAsideWidth,
  header,
  headerClassName,
  headerPosition = "inside",
  footer,
  footerClassName,
  footerPosition = "inside",
  actionBar,
  actionBarClassName,
  scrollable,
  scrollMargin = false,
  margin,
  gap = globalCssVars.spacingSm,
  children
}: PageProps) {
  const pageKey = usePageKey();

  // Entrance orchestration signal (see ./entrance). The controller lives in a
  // ref and the context receives the stable store reference, so settling the
  // entrance re-renders nothing — the animation callbacks below write the
  // store (notifying only actual subscribers) and mirror the state onto the
  // root's `data-entrance` attribute for CSS consumers. React never rewrites
  // that attribute: it only diffs against its own unchanged JSX value.
  const entranceRef = useRef<ReturnType<typeof createPageEntranceController> | null>(null);
  entranceRef.current ??= createPageEntranceController();
  const entrance = entranceRef.current;
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isHeaderOutside = Boolean(header && headerPosition === "outside");
  const isFooterOutside = Boolean(footer && footerPosition === "outside");

  const pageStyle = useMemo<CSSProperties>(() => {
    return {
      ...buildGridStyle({
        hasLeft: Boolean(leftAside),
        hasRight: Boolean(rightAside),
        isHeaderOutside,
        isFooterOutside
      }),
      "--vef-page-grid-gap": getSpacingValue(gap),
      "--vef-page-margin": margin ? globalCssVars.spacingSm : "0px",
      "--vef-page-scroll-margin": scrollMargin ? globalCssVars.spacingSm : "0px",
      "--vef-page-scroll-wrapper-margin": scrollMargin ? `calc(${globalCssVars.spacingXxs} / 2)` : "0px",
      "--vef-page-scroll-container-margin": scrollMargin ? `calc(${globalCssVars.spacingXs} + ${globalCssVars.spacingXxs} / 2)` : "0px"
    };
  }, [leftAside, rightAside, isHeaderOutside, isFooterOutside, gap, margin, scrollMargin]);

  const mainContent = scrollable
    ? (
        <ScrollContent
          actionBar={actionBar}
          actionBarClassName={actionBarClassName}
          className={mainClassName}
        >
          {children}
        </ScrollContent>
      )
    : (
        <div className={mainClassName} css={styles.content}>
          {children}
        </div>
      );

  return (
    <PageEntranceContext value={entrance.store}>
      <motion.div
        key={pageKey}
        ref={rootRef}
        animate="animate"
        className={className}
        css={styles.page}
        data-entrance="entering"
        initial="initial"
        style={pageStyle}
        transition={pageTransition}
        variants={pageVariants}
        onAnimationComplete={definition => {
          if (definition === "animate") {
            entrance.setSettled(true);
            rootRef.current?.setAttribute("data-entrance", "settled");
          }
        }}
        onAnimationStart={definition => {
          // A page reload remounts the motion.div and replays the entrance;
          // flip the signal back so consumers re-arm.
          if (definition === "animate") {
            entrance.setSettled(false);
          }
        }}
      >
        {isHeaderOutside && (
          <div className={headerClassName} css={styles.headerOutside}>
            {header}
          </div>
        )}

        {leftAside && (
          <AsidePanel
            className={leftAsideClassName}
            containerStyle={styles.leftAside}
            position="left"
            width={leftAsideWidth}
          >
            {leftAside}
          </AsidePanel>
        )}

        <div css={styles.main}>
          {header && headerPosition === "inside" && (
            <div className={headerClassName} css={styles.header}>
              {header}
            </div>
          )}

          {mainContent}

          {footer && footerPosition === "inside" && (
            <div className={footerClassName} css={styles.footer}>
              {footer}
            </div>
          )}
        </div>

        {rightAside && (
          <AsidePanel
            className={rightAsideClassName}
            containerStyle={styles.rightAside}
            position="right"
            width={rightAsideWidth}
          >
            {rightAside}
          </AsidePanel>
        )}

        {isFooterOutside && (
          <div className={footerClassName} css={styles.footerOutside}>
            {footer}
          </div>
        )}
      </motion.div>
    </PageEntranceContext>
  );
}

export { usePageEntranceEffect, usePageEntranceSettled, type PageEntranceStore } from "./entrance";
export { type AsideWidth, type PageProps, type Position, type ResizableWidth } from "./props";
export { useViewportHeight } from "./viewport-context";
