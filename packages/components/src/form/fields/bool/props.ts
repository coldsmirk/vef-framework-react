import type { Except } from "@vef-framework-react/shared";

import type { BoolProps } from "../../../bool";

export interface BoolFieldProps extends Except<BoolProps, "value" | "defaultValue" | "onChange"> {
}
