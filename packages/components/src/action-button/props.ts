import type { Awaitable, Except, SetReturnType } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { ActionConfirmMode, GetProp } from "../_base";
import type { ButtonProps } from "../button";

/**
 * The props for the ActionButton component.
 *
 * @see {@link ButtonProps}
 */
export interface ActionButtonProps extends Except<ButtonProps, "loading" | "onClick"> {
  /**
   * Whether the action requires confirm before execution.
   *
   * @default false
   */
  confirmable?: boolean;
  /**
   * The confirm mode for the action.
   *
   * @default "popover"
   */
  confirmMode?: ActionConfirmMode;
  /**
   * The title of the confirm dialog.
   *
   * @default "确认提示"
   */
  confirmTitle?: ReactNode;
  /**
   * The description of the confirm dialog.
   *
   * @default "确定要执行此操作吗？"
   */
  confirmDescription?: ReactNode;
  /**
   * The click handler that supports async operations.
   */
  onClick?: SetReturnType<GetProp<ButtonProps, "onClick">, Awaitable<void>>;
}
