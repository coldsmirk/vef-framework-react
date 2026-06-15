import type { Except } from "@vef-framework-react/shared";

import type { AutoCompleteProps } from "../../../auto-complete";

export interface AutoCompleteFieldProps extends Except<AutoCompleteProps, "value" | "defaultValue" | "onChange"> {
  /**
   * Whether to preserve empty string instead of converting to null
   *
   * @default false - Empty strings will be converted to null
   */
  preserveEmptyString?: boolean;
}
