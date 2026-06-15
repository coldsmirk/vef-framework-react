import type { MaybeNullish } from "@vef-framework-react/shared";

import type { AutoCompleteFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";
import { isEmpty } from "@vef-framework-react/shared";

import { styles } from "../../../_base";
import { AutoComplete } from "../../../auto-complete";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function AutoCompleteComponent({
  disabled,
  preserveEmptyString = false,
  ...props
}: AutoCompleteFieldProps) {
  const {
    state: {
      value
    },
    handleBlur,
    handleChange
  } = useFieldContext<MaybeNullish<string>>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <AutoComplete
      {...props}
      css={styles.fullWidth}
      disabled={isDisabled}
      value={value}
      onBlur={handleBlur}
      onChange={input => {
        handleChange(preserveEmptyString || !isEmpty(input) ? input : null);
      }}
    />
  );
}

export const AutoCompleteField = withFormItem("AutoCompleteField", AutoCompleteComponent);

export { type AutoCompleteFieldProps } from "./props";
