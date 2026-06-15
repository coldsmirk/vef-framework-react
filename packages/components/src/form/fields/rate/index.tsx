import type { RateFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { Rate } from "../../../rate";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function RateComponent({
  disabled,
  ...props
}: RateFieldProps) {
  const {
    state: {
      value
    },
    handleBlur,
    handleChange
  } = useFieldContext<number>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Rate
      {...props}
      disabled={isDisabled}
      value={value}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  );
}

export const RateField = withFormItem("RateField", RateComponent);

export { type RateFieldProps } from "./props";
