import type { DataOption } from "@vef-framework-react/core";
import type { Except } from "@vef-framework-react/shared";

import type { TreeSelectProps } from "../../../tree-select";

export interface TreeSelectFieldProps<TValue, TOption extends DataOption> extends Except<TreeSelectProps<TValue, TOption>, "value" | "defaultValue" | "onChange"> {
}
