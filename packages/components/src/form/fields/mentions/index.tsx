import type { MentionsFieldProps } from "./props";

import { useDisabled } from "@vef-framework-react/core";

import { styles } from "../../../_base";
import { Mentions } from "../../../mentions";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function MentionsComponent({
  disabled,
  ...props
}: MentionsFieldProps) {
  const {
    state: {
      value
    },
    handleBlur,
    handleChange
  } = useFieldContext<string>();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  return (
    <Mentions
      {...props}
      css={styles.fullWidth}
      disabled={isDisabled}
      value={value}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  );
}

export const MentionsField = withFormItem("MentionsField", MentionsComponent);

export { type MentionsFieldProps } from "./props";
