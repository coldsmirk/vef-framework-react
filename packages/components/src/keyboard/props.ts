import type { ComponentProps } from "react";

import type { Size } from "../_base";

/**
 * The props of the Keyboard component.
 */
export interface KeyboardProps extends ComponentProps<"kbd"> {
  /**
   * The size of the keyboard.
   *
   * @default "medium"
   */
  size?: Size;
}
