import type { Except } from "@vef-framework-react/shared";
import type { LucideIcon, LucideProps } from "lucide-react";
import type { JSXElementConstructor, ReactElement, ReactNode } from "react";

import type { ButtonProps } from "../button";
import type { TooltipProps } from "../tooltip";

/**
 * The props for the `IconButton` component
 */
export interface IconButtonProps extends Except<
  ButtonProps,
  | "icon"
  | "iconPosition"
  | "type"
  | "htmlType"
  | "autoInsertSpace"
  | "color"
  | "variant"
  | "ghost"
  | "danger"
  | "block"
>, Pick<TooltipProps, "placement"> {
  /**
   * The icon of the button.
   */
  icon: ReactElement<LucideProps, JSXElementConstructor<LucideIcon>>;
  /**
   * The tooltip of the button.
   */
  tip?: ReactNode;
  /**
   * The delay before the tooltip becomes visible.
   */
  tipDelay?: number;
}
