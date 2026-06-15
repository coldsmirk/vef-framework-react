import type { TransferFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { Transfer } from "../../../transfer";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function TransferComponent({
  disabled,
  ...props
}: TransferFieldProps) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<string[]>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Transfer
      {...props}
      disabled={isDisabled}
      targetKeys={value}
      onChange={targetKeys => {
        handleChange(targetKeys as string[]);
      }}
    />
  );
}

export const TransferField = withFormItem("TransferField", TransferComponent);

export { type TransferFieldProps } from "./props";
