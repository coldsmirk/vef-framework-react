import type { MaybeUndefined } from "@vef-framework-react/shared";

import type { IconPickerFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { IconPicker } from "../../../icon-picker";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function IconPickerComponent({
  disabled,
  ...props
}: IconPickerFieldProps) {
  const {
    state: {
      value
    },
    handleBlur,
    handleChange
  } = useFieldContext<MaybeUndefined<string>>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <IconPicker
      {...props}
      disabled={isDisabled}
      value={value}
      onBlur={handleBlur}
      onChange={next => handleChange(next ?? undefined)}
    />
  );
}

export const IconPickerField = withFormItem("IconPickerField", IconPickerComponent);

export { type IconPickerFieldProps } from "./props";
