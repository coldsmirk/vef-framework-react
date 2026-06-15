import type { ReactNode } from "react";

import type { FieldComponentProps } from "../../types";
import type { DatePickerFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";
import { tryParseDate } from "@vef-framework-react/shared";

import { styles } from "../../../_base";
import { DatePicker } from "../../../date-picker";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function DatePickerComponent({
  disabled,
  valueAsObject,
  ...props
}: DatePickerFieldProps) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<any>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <DatePicker
      {...props}
      css={styles.fullWidth}
      disabled={isDisabled}
      value={typeof value === "string" ? tryParseDate(value) : value}
      onChange={valueAsObject
        ? handleChange
        : (_, dateString) => handleChange(dateString || null)}
    />
  );
}

export const DatePickerField = withFormItem("DatePickerField", DatePickerComponent) as
  <TValueAsObject extends boolean = false>(props: FieldComponentProps<DatePickerFieldProps<TValueAsObject>>) => ReactNode;

export { type DatePickerFieldProps } from "./props";
