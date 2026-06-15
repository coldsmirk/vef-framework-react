import type { ComponentProps } from "react";

/**
 * The props of the SparklesText component.
 */
export interface SparklesTextProps extends ComponentProps<"div"> {
  /**
   * The number of sparkles to display.
   *
   * @default 10
   */
  sparklesCount?: number;
}
