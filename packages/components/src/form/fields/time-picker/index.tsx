import type { ReactNode } from "react";

import type { FieldComponentProps } from "../../types";
import type { TimePickerFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";
import { tryParseTime } from "@vef-framework-react/shared";

import { styles } from "../../../_base";
import { TimePicker } from "../../../time-picker";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function TimePickerComponent({
  disabled,
  valueAsObject,
  ...props
}: TimePickerFieldProps) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<any>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <TimePicker
      {...props}
      css={styles.fullWidth}
      disabled={isDisabled}
      value={typeof value === "string" ? tryParseTime(value) : value}
      onChange={valueAsObject
        ? handleChange
        : (_, timeString) => handleChange(timeString || null)}
    />
  );
}

export const TimePickerField = withFormItem("TimePickerField", TimePickerComponent) as
  <TValueAsObject extends boolean = false>(props: FieldComponentProps<TimePickerFieldProps<TValueAsObject>>) => ReactNode;

export { type TimePickerFieldProps } from "./props";
