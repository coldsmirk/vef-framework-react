import type { Except } from "@vef-framework-react/shared";

import type { DatePickerProps } from "../../../date-picker";

export interface DatePickerFieldProps<TValueAsObject extends boolean = false> extends Except<DatePickerProps, "value" | "defaultValue" | "onChange" | "onChangeCapture"> {
  /**
   * When true, the form field stores Dayjs instances.
   * When false or omitted (default), the form field stores formatted strings.
   */
  valueAsObject?: TValueAsObject;
}
