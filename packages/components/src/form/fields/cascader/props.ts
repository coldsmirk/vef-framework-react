import type { Except } from "@vef-framework-react/shared";

import type { CascaderProps } from "../../../cascader";

export interface CascaderFieldProps extends Except<CascaderProps, "value" | "defaultValue" | "onChange"> {
}
