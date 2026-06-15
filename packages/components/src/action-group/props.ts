import type { ReactNode } from "react";

import type { ActionButtonConfig } from "../_base";
import type { ButtonProps } from "../button";

/**
 * The props of the action group.
 *
 * @template T - The context type of the action group.
 */
export interface ActionGroupProps<T = never> extends Pick<ButtonProps, "size"> {
  /**
   * The buttons of the action group.
   */
  buttons: Array<ActionButtonConfig<T>>;
  /**
   * The render wrapper of the action group.
   */
  renderWrapper?: (buttonsNode: ReactNode) => ReactNode;
}
