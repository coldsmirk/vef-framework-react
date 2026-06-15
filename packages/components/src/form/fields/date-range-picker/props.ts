import type { Except } from "@vef-framework-react/shared";

import type { DateRangePickerProps } from "../../../date-picker";

export interface DateRangePickerFieldProps<TValueAsObject extends boolean = false> extends Except<DateRangePickerProps, "value" | "defaultValue" | "onChange" | "onChangeCapture"> {
  /**
   * When true, the form field stores Dayjs instances.
   * When false or omitted (default), the form field stores formatted strings.
   */
  valueAsObject?: TValueAsObject;
}
