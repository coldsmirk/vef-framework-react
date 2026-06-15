import type { MaybeNullish } from "@vef-framework-react/shared";

import type { TextAreaFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";
import { isEmpty } from "@vef-framework-react/shared";

import { Input } from "../../../input";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function TextAreaComponent({
  disabled,
  preserveEmptyString = false,
  ...props
}: TextAreaFieldProps) {
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
    <Input.TextArea
      {...props}
      disabled={isDisabled}
      value={value!}
      onBlur={handleBlur}
      onChange={event => {
        const input = event.currentTarget.value;
        handleChange(preserveEmptyString || !isEmpty(input) ? input : null);
      }}
    />
  );
}

export const TextAreaField = withFormItem("TextAreaField", TextAreaComponent);

export { type TextAreaFieldProps } from "./props";
