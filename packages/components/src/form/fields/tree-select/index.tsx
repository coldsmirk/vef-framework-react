import type { DataOption } from "@vef-framework-react/core";
import type { MaybeUndefined } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { FieldComponentProps } from "../..";
import type { TreeSelectFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { TreeSelect } from "../../../tree-select";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function TreeSelectComponent<TValue, TOption extends DataOption>({
  disabled,
  ...props
}: TreeSelectFieldProps<TValue, TOption>) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<MaybeUndefined<TValue>>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <TreeSelect
      {...props}
      disabled={isDisabled}
      value={value}
      onChange={handleChange}
    />
  );
}

export const TreeSelectField
  = withFormItem("TreeSelectField", TreeSelectComponent) as <TValue, TOption extends DataOption>(
    props: FieldComponentProps<TreeSelectFieldProps<TValue, TOption>>
  ) => ReactNode;

export { type TreeSelectFieldProps } from "./props";
