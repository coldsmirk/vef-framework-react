import type { Except } from "@vef-framework-react/shared";

import type { ColorPickerProps } from "../../../color-picker";

export interface ColorPickerFieldProps extends Except<ColorPickerProps, "value" | "defaultValue" | "onChange"> {
}
