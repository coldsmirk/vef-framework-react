import type { Except } from "@vef-framework-react/shared";

import type { PasswordProps } from "../../../input";

export interface PasswordFieldProps extends Except<PasswordProps, "name" | "value" | "onChange" | "onChangeCapture" | "onBlur" | "onBlurCapture"> {
  /**
   * Whether to preserve empty string instead of converting to null
   *
   * @default false - Empty strings will be converted to null
   */
  preserveEmptyString?: boolean;
}
