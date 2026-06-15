import type { CheckboxFieldProps, CheckboxGroupFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { Checkbox } from "../../../checkbox";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function CheckboxComponent({
  disabled,
  ...props
}: CheckboxFieldProps) {
  const {
    state: {
      value
    },
    handleBlur,
    handleChange
  } = useFieldContext<boolean>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Checkbox
      {...props}
      checked={value}
      disabled={isDisabled}
      onBlur={handleBlur}
      onChange={event => {
        handleChange(event.target.checked);
      }}
    />
  );
}

function CheckboxGroupComponent({
  disabled,
  ...props
}: CheckboxGroupFieldProps) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<any[]>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Checkbox.Group
      {...props}
      disabled={isDisabled}
      value={value}
      onChange={handleChange}
    />
  );
}

export const CheckboxField = withFormItem("CheckboxField", CheckboxComponent);
export const CheckboxGroupField = withFormItem("CheckboxGroupField", CheckboxGroupComponent);

export { type CheckboxFieldProps, type CheckboxGroupFieldProps } from "./props";
