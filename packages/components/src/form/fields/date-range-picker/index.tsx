import type { Dayjs, MaybeNullish } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { RangeValue } from "../../../_base";
import type { FieldComponentProps } from "../../types";
import type { DateRangePickerFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";
import { isArray, isString, tryParseDate } from "@vef-framework-react/shared";

import { styles } from "../../../_base";
import { DatePicker } from "../../../date-picker";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

type FieldValue = MaybeNullish<RangeValue<MaybeNullish<Dayjs | string>>>;

function coerceValue(value: FieldValue): MaybeNullish<RangeValue<MaybeNullish<Dayjs>>> {
  if (isArray(value)) {
    const [start, end] = value;

    return [
      isString(start) ? tryParseDate(start) : start,
      isString(end) ? tryParseDate(end) : end
    ];
  }

  return value;
}

function DateRangePickerComponent<TValueAsObject extends boolean = false>({
  disabled,
  valueAsObject,
  ...props
}: DateRangePickerFieldProps<TValueAsObject>) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<FieldValue>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <DatePicker.RangePicker
      {...props}
      css={styles.fullWidth}
      disabled={isDisabled}
      value={coerceValue(value)}
      onChange={
        valueAsObject
          ? handleChange
          : (_, formattedValue) => handleChange(formattedValue)
      }
    />
  );
}

export const DateRangePickerField = withFormItem("DateRangePickerField", DateRangePickerComponent) as
  <TValueAsObject extends boolean = false>(props: FieldComponentProps<DateRangePickerFieldProps<TValueAsObject>>) => ReactNode;

export { type DateRangePickerFieldProps } from "./props";
