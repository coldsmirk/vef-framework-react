import type { Except } from "@vef-framework-react/shared";

import type { CodeEditorProps } from "../../../code-editor";

export interface CodeEditorFieldProps extends Except<CodeEditorProps, "value" | "defaultValue" | "onChange" | "onBlur"> {
  /**
   * Disable editing through the form context. Maps to `readOnly` on the
   * underlying CodeEditor so the user can still focus and copy text.
   */
  disabled?: boolean;
  /**
   * Whether to preserve empty string instead of converting to null
   *
   * @default false - Empty strings will be converted to null
   */
  preserveEmptyString?: boolean;
}
