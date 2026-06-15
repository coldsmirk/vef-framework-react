import type { DataOption } from "@vef-framework-react/core";
import type { MaybeUndefined } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { FieldComponentProps } from "../..";
import type { SelectFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { Select } from "../../../select";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function SelectComponent<TValue, TOption extends DataOption>({
  disabled,
  ...props
}: SelectFieldProps<TValue, TOption>) {
  const {
    state: {
      value
    },
    handleBlur,
    handleChange
  } = useFieldContext<MaybeUndefined<TValue>>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Select
      {...props}
      disabled={isDisabled}
      value={value}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  );
}

export const SelectField
  = withFormItem("SelectField", SelectComponent) as <TValue, TOption extends DataOption>(
    props: FieldComponentProps<SelectFieldProps<TValue, TOption>>
  ) => ReactNode;

export { type SelectFieldProps } from "./props";
