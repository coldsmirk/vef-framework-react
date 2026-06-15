import type { Dayjs, MaybeNullish } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { RangeValue } from "../../../_base";
import type { FieldComponentProps } from "../../types";
import type { TimeRangePickerFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";
import { isArray, isString, tryParseTime } from "@vef-framework-react/shared";

import { styles } from "../../../_base";
import { TimePicker } from "../../../time-picker";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

type FieldValue = MaybeNullish<RangeValue<MaybeNullish<Dayjs | string>>>;

function coerceValue(value: FieldValue): MaybeNullish<RangeValue<MaybeNullish<Dayjs>>> {
  if (isArray(value)) {
    const [start, end] = value;

    return [
      isString(start) ? tryParseTime(start) : start,
      isString(end) ? tryParseTime(end) : end
    ];
  }

  return value;
}

function TimeRangePickerComponent<TValueAsObject extends boolean = false>({
  disabled,
  valueAsObject,
  ...props
}: TimeRangePickerFieldProps<TValueAsObject>) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<FieldValue>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <TimePicker.RangePicker
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

export const TimeRangePickerField = withFormItem("TimeRangePickerField", TimeRangePickerComponent) as
  <TValueAsObject extends boolean = false>(props: FieldComponentProps<TimeRangePickerFieldProps<TValueAsObject>>) => ReactNode;

export { type TimeRangePickerFieldProps } from "./props";
