import type { Except } from "@vef-framework-react/shared";

import type { TimeRangePickerProps } from "../../../time-picker";

export interface TimeRangePickerFieldProps<TValueAsObject extends boolean = false> extends Except<TimeRangePickerProps, "value" | "defaultValue" | "onChange" | "onChangeCapture"> {
  /**
   * When true, the form field stores Dayjs instances.
   * When false or omitted (default), the form field stores formatted strings.
   */
  valueAsObject?: TValueAsObject;
}
