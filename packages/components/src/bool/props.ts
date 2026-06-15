import type { CSSProperties, ReactNode } from "react";

import type { Size } from "../_base";

/**
 * The variant of the Bool component
 */
export type BoolVariant = "radio" | "radio-button" | "switch" | "checkbox";

/**
 * The props for the `Bool` component
 */
export interface BoolProps {
  /**
   * The class name of the component.
   */
  className?: string;
  /**
   * The style of the component.
   */
  style?: CSSProperties;
  /**
   * The value of the component (controlled).
   */
  value?: boolean;
  /**
   * The default value of the component (uncontrolled).
   */
  defaultValue?: boolean;
  /**
   * The variant of the component.
   *
   * @default "switch"
   */
  variant?: BoolVariant;
  /**
   * The label for the true/checked state.
   * - For radio variant: displayed on the true radio option
   * - For radio-button variant: displayed on the true button
   * - For switch variant: displayed inside the switch when checked
   *
   * @default "是"
   */
  trueLabel?: ReactNode;
  /**
   * The label for the false/unchecked state.
   * - For radio variant: displayed on the false radio option
   * - For radio-button variant: displayed on the false button
   * - For switch variant: displayed inside the switch when unchecked
   *
   * @default "否"
   */
  falseLabel?: ReactNode;
  /**
   * Whether the component is disabled.
   */
  disabled?: boolean;
  /**
   * The size of the component.
   */
  size?: Size;
  /**
   * The callback function when the value changes.
   */
  onChange?: (value: boolean) => void;
  /**
   * The label text for switch/checkbox variants.
   */
  children?: ReactNode;
}
