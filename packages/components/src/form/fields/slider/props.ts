import type { Except } from "@vef-framework-react/shared";

import type { SliderSingleProps } from "../../../slider";

export interface SliderFieldProps extends Except<SliderSingleProps, "value" | "defaultValue" | "onChange"> {
}
