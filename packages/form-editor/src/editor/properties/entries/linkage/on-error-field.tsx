import type { ReactElement } from "react";

import type { ActionErrorPolicy } from "../../../../types";
import type { OptionItem } from "./options";

import { Select } from "@vef-framework-react/components";

import { DraftField } from "../../draft-modal";
import { selectStyle } from "./styles";

const ON_ERROR_OPTIONS: Array<OptionItem<ActionErrorPolicy>> = [
  { value: "stop", label: "失败时终止后续步骤（默认）" },
  { value: "continue", label: "忽略失败，继续后续步骤" }
];

export interface OnErrorFieldProps {
  value: ActionErrorPolicy | undefined;
  /**
   * `undefined` is the default, which is not stored.
   */
  onChange: (next: ActionErrorPolicy | undefined) => void;
}

export function OnErrorField({ onChange, value }: OnErrorFieldProps): ReactElement {
  return (
    <DraftField label="失败处理">
      <Select
        aria-label="失败处理"
        options={ON_ERROR_OPTIONS}
        style={selectStyle}
        value={value ?? "stop"}
        onChange={next => onChange(next === "continue" ? "continue" : undefined)}
      />
    </DraftField>
  );
}
