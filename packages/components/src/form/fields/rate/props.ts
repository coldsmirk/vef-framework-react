import type { Except } from "@vef-framework-react/shared";

import type { RateProps } from "../../../rate";

export interface RateFieldProps extends Except<RateProps, "value" | "defaultValue" | "onChange"> {
}
