import type { Except } from "@vef-framework-react/shared";

import type { InputProps } from "../../../input";

export interface InputFieldProps extends Except<InputProps, "name" | "value" | "onChange" | "onChangeCapture" | "onBlur" | "onBlurCapture"> {
  /**
   * Whether to preserve empty string instead of converting to null
   *
   * @default false - Empty strings will be converted to null
   */
  preserveEmptyString?: boolean;
}
