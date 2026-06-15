import type { RadioFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { Radio } from "../../../radio";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function RadioComponent({
  disabled,
  ...props
}: RadioFieldProps) {
  const {
    state: {
      value
    },
    handleBlur,
    handleChange
  } = useFieldContext();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Radio.Group
      {...props}
      disabled={isDisabled}
      value={value}
      onBlur={handleBlur}
      onChange={event => {
        handleChange(event.target.value);
      }}
    />
  );
}

export const RadioField = withFormItem("RadioField", RadioComponent);

export { type RadioFieldProps } from "./props";
