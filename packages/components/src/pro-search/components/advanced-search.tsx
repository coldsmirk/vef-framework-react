import type { Transition, Variants } from "@vef-framework-react/core";
import type { PropsWithChildren } from "react";

import { AnimatePresence, motion } from "@vef-framework-react/core";
import { memo } from "react";

import * as styles from "../styles";

interface AdvancedSearchProps {
  isVisible: boolean;
}

const variants: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: "auto" }
};

const transition: Transition = {
  duration: 0.2,
  ease: "easeInOut"
};

export const AdvancedSearch = memo(({ children, isVisible }: PropsWithChildren<AdvancedSearchProps>) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        animate="visible"
        exit="hidden"
        initial="hidden"
        transition={transition}
        variants={variants}
      >
        <div css={styles.advancedSearch}>{children}</div>
      </motion.div>
    )}
  </AnimatePresence>
));

AdvancedSearch.displayName = "AdvancedSearch";
