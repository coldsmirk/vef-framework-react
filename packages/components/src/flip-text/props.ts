import type { CSSProperties, PropsWithChildren } from "react";

/**
 * The props of the FlipText component.
 */
export interface FlipTextProps extends PropsWithChildren {
  /**
   * Additional CSS class name for the component.
   */
  className?: string;
  /**
   * Custom CSS styles to apply to the component.
   */
  style?: CSSProperties;
  /**
   * Animation duration in seconds.
   *
   * @default 0.6
   */
  duration?: number;
  /**
   * Delay multiplier for staggered animations between characters.
   *
   * @default 0.08
   */
  delayMultiple?: number;
  /**
   * The number of times to repeat the animation.
   *
   * @default 0
   */
  repeat?: number;
}
