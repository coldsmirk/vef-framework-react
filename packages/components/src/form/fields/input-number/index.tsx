import type { MaybeNullish } from "@vef-framework-react/shared";

import type { InputNumberFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { styles } from "../../../_base";
import { InputNumber } from "../../../input-number";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function InputNumberComponent({
  disabled,
  ...props
}: InputNumberFieldProps) {
  const {
    state: { value },
    handleBlur,
    handleChange
  } = useFieldContext<MaybeNullish<number | string>>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <InputNumber
      {...props}
      css={styles.fullWidth}
      disabled={isDisabled}
      value={value}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  );
}

export const InputNumberField = withFormItem("InputNumberField", InputNumberComponent);

export { type InputNumberFieldProps } from "./props";
