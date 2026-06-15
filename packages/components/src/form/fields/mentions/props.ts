import type { Except } from "@vef-framework-react/shared";

import type { MentionsProps } from "../../../mentions";

export interface MentionsFieldProps extends Except<MentionsProps, "value" | "defaultValue" | "onChange" | "onChangeCapture"> {
}
