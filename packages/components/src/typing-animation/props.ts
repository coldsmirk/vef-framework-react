import type { motion } from "@vef-framework-react/core";
import type { ComponentProps } from "react";

/**
 * The props of the TypingAnimation component.
 */
export interface TypingAnimationProps extends ComponentProps<typeof motion.div> {
  /**
   * Duration in milliseconds between each character animation.
   *
   * @default 100ms
   */
  duration?: number;
  /**
   * Delay in milliseconds before starting the typing animation.
   *
   * @default 0ms
   */
  delay?: number;
  /**
   * Whether to start the animation only when the element comes into view.
   *
   * @default false
   */
  startOnView?: boolean;
}
