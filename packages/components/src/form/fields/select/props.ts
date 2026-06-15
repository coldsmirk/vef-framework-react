import type { DataOption } from "@vef-framework-react/core";
import type { Except } from "@vef-framework-react/shared";

import type { SelectProps } from "../../../select";

export interface SelectFieldProps<TValue, TOption extends DataOption> extends Except<SelectProps<TValue, TOption>, "value" | "onBlur"> {
}
