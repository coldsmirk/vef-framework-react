import type { ColorPickerFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { ColorPicker } from "../../../color-picker";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function ColorPickerComponent({
  disabled,
  ...props
}: ColorPickerFieldProps) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<any>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <ColorPicker
      {...props}
      disabled={isDisabled}
      value={value}
      onChange={handleChange}
    />
  );
}

export const ColorPickerField = withFormItem("ColorPickerField", ColorPickerComponent);

export { type ColorPickerFieldProps } from "./props";
