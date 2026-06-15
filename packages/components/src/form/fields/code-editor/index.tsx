import type { MaybeNullish } from "@vef-framework-react/shared";

import type { CodeEditorFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";
import { isEmpty } from "@vef-framework-react/shared";

import { CodeEditor } from "../../../code-editor";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function CodeEditorComponent({
  disabled,
  readOnly,
  preserveEmptyString = false,
  ...props
}: CodeEditorFieldProps) {
  const {
    state: {
      value
    },
    handleBlur,
    handleChange
  } = useFieldContext<MaybeNullish<string>>();
  const contextDisabled = useDisabled();
  const isReadOnly = contextDisabled || disabled || readOnly;

  return (
    <CodeEditor
      {...props}
      readOnly={isReadOnly}
      value={value ?? ""}
      onBlur={handleBlur}
      onChange={input => {
        handleChange(preserveEmptyString || !isEmpty(input) ? input : null);
      }}
    />
  );
}

export const CodeEditorField = withFormItem("CodeEditorField", CodeEditorComponent);

export { type CodeEditorFieldProps } from "./props";
