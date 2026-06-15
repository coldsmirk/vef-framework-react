import type { Except } from "@vef-framework-react/shared";

import type { IconPickerProps } from "../../../icon-picker";

/**
 * Props for `IconPickerField` — the {@link IconPickerProps} surface minus the
 * value/change wiring the form owns: `value`, `defaultValue`, `onChange`, and
 * `onBlur` all come from the field state, so they are not part of the public
 * field props.
 */
export interface IconPickerFieldProps extends Except<IconPickerProps, "value" | "defaultValue" | "onChange" | "onBlur"> {}
