import type { Transition, Variants } from "@vef-framework-react/core";
import type { CSSProperties, PropsWithChildren, ReactElement, ReactNode } from "react";

import { ClassNames } from "@emotion/react";
import { AnimatePresence, motion } from "@vef-framework-react/core";
import { useElementSize } from "@vef-framework-react/hooks";

import { ScrollArea } from "../../scroll-area";
import * as styles from "../styles";
import { ViewportProvider } from "../viewport-context";

interface ScrollContentProps extends PropsWithChildren {
  className?: string;
  actionBar?: ReactNode;
  actionBarClassName?: string;
}

const actionBarVariants: Variants = {
  initial: {
    opacity: 0,
    y: 60
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    y: 60,
    transition: {
      ease: "easeIn"
    }
  }
};

const actionBarTransition: Transition = {
  duration: 0.3
};

export function ScrollContent({
  className,
  actionBar,
  actionBarClassName,
  children
}: ScrollContentProps): ReactElement {
  const { ref: actionBarRef, height: actionBarHeight } = useElementSize();
  const { ref: viewportRef, height: viewportHeight } = useElementSize();

  const viewportStyle = {
    "--vef-page-action-bar-height": `${actionBarHeight}px`
  } as CSSProperties;

  return (
    <>
      <ClassNames>
        {({ css }) => (
          <ScrollArea
            className={className}
            css={[styles.content, styles.scrollWrapper]}
            viewportClassName={css(styles.scrollContainer)}
            viewportRef={viewportRef}
            viewportStyle={viewportStyle}
          >
            <ViewportProvider value={viewportHeight}>
              {children}
            </ViewportProvider>
          </ScrollArea>
        )}
      </ClassNames>

      <AnimatePresence>
        {actionBar && (
          <motion.div
            ref={actionBarRef}
            animate="animate"
            className={actionBarClassName}
            css={styles.actionBar}
            exit="exit"
            initial="initial"
            transition={actionBarTransition}
            variants={actionBarVariants}
          >
            {actionBar}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
