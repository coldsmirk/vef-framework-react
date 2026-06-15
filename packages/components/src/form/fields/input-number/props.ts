import type { Except } from "@vef-framework-react/shared";

import type { InputNumberProps } from "../../../input-number";

export interface InputNumberFieldProps extends Except<InputNumberProps, "name" | "value" | "onChange" | "onChangeCapture" | "onBlur" | "onBlurCapture"> {
}
