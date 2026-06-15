import type { Except } from "@vef-framework-react/shared";

import type { TextAreaProps } from "../../../input";

export interface TextAreaFieldProps extends Except<TextAreaProps, "name" | "value" | "onChange" | "onChangeCapture" | "onBlur" | "onBlurCapture"> {
  /**
   * Whether to preserve empty string instead of converting to undefined
   *
   * @default false - Empty strings will be converted to undefined
   */
  preserveEmptyString?: boolean;
}
