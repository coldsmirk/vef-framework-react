import type { Except } from "@vef-framework-react/shared";

import type { TimePickerProps } from "../../../time-picker";

export interface TimePickerFieldProps<TValueAsObject extends boolean = false> extends Except<TimePickerProps, "value" | "defaultValue" | "onChange" | "onChangeCapture"> {
  /**
   * When true, the form field stores Dayjs instances.
   * When false or omitted (default), the form field stores formatted strings.
   */
  valueAsObject?: TValueAsObject;
}
