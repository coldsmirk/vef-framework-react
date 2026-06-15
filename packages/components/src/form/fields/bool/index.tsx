import type { BoolFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { Bool } from "../../../bool";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function BoolComponent({
  disabled,
  ...props
}: BoolFieldProps) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<boolean>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Bool
      {...props}
      disabled={isDisabled}
      value={value}
      onChange={handleChange}
    />
  );
}

export const BoolField = withFormItem("BoolField", BoolComponent);

export { type BoolFieldProps } from "./props";
