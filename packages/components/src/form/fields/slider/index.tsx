import type { SliderFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { Slider } from "../../../slider";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function SliderComponent({
  disabled,
  ...props
}: SliderFieldProps) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<number>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Slider
      {...props}
      disabled={isDisabled}
      value={value}
      onChange={handleChange}
    />
  );
}

export const SliderField = withFormItem("SliderField", SliderComponent);

export { type SliderFieldProps } from "./props";
