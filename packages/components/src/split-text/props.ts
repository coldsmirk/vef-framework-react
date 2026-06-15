import type { CSSProperties } from "react";

/**
 * The props for the SplitText component.
 */
export interface SplitTextProps {
  /**
   * HTML tag to render: 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'.
   *
   * @default "p"
   */
  tag?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";

  /**
   * The text content to animate.
   */
  text: string;

  /**
   * Additional class names to style the component.
   */
  className?: string;

  /**
   * Delay between animations for each letter (in ms).
   *
   * @default 100
   */
  delay?: number;

  /**
   * Duration of each letter animation (in seconds).
   *
   * @default 0.6
   */
  duration?: number;

  /**
   * GSAP easing function for the animation.
   *
   * @default "power3.out"
   */
  ease?: string | ((t: number) => number);

  /**
   * Split type: "chars", "words", "lines", or "words, chars".
   *
   * @default "chars"
   */
  splitType?: "chars" | "words" | "lines" | "words, chars";

  /**
   * Initial GSAP properties for each letter/word.
   *
   * @default { opacity: 0, y: 40 }
   */
  from?: gsap.TweenVars;

  /**
   * Target GSAP properties for each letter/word.
   *
   * @default { opacity: 1, y: 0 }
   */
  to?: gsap.TweenVars;

  /**
   * Intersection threshold to trigger the animation (0-1).
   *
   * @default 0.1
   */
  threshold?: number;

  /**
   * Root margin for the ScrollTrigger.
   *
   * @default "-100px"
   */
  rootMargin?: string;

  /**
   * Text alignment: 'left', 'center', 'right', etc.
   *
   * @default "center"
   */
  textAlign?: CSSProperties["textAlign"];

  /**
   * Callback function when all animations complete.
   */
  onLetterAnimationComplete?: () => void;
}
