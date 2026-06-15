import type { Except } from "@vef-framework-react/shared";

import type { CheckboxGroupProps, CheckboxProps } from "../../../checkbox";

export interface CheckboxFieldProps extends Except<CheckboxProps, "checked" | "defaultChecked" | "value" | "onChange"> {
}

export interface CheckboxGroupFieldProps extends Except<CheckboxGroupProps, "value" | "defaultValue" | "onChange"> {
}
