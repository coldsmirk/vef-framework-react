import type { CascaderFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { styles } from "../../../_base";
import { Cascader } from "../../../cascader";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function CascaderComponent({
  disabled,
  ...props
}: CascaderFieldProps) {
  const {
    state: {
      value
    },
    handleChange
  } = useFieldContext<any>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Cascader
      {...props}
      css={styles.fullWidth}
      disabled={isDisabled}
      value={value}
      onChange={handleChange}
    />
  );
}

export const CascaderField = withFormItem("CascaderField", CascaderComponent);

export { type CascaderFieldProps } from "./props";
