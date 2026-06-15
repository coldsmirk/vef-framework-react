import type { Except } from "@vef-framework-react/shared";

import type { RadioGroupProps } from "../../../radio";

export interface RadioFieldProps extends Except<RadioGroupProps, "value" | "defaultValue" | "onChange"> {
}
