import type { ReactElement } from "react";

import { Input } from "@vef-framework-react/components";
import { useId } from "react";

import { sanitizeKey } from "../../../../engine/keys";
import { DraftField } from "../../draft-modal";

export interface StepOutputFieldProps {
  error: string | null;
  required: boolean;
  value: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onPressEnter?: () => void;
}

/**
 * Controlled output-name input for `api_call` and `select_record` steps inside
 * the rule draft dialog.
 */
export function StepOutputField({
  error,
  onBlur,
  onChange,
  onPressEnter,
  required,
  value
}: StepOutputFieldProps): ReactElement {
  const inputId = useId();

  return (
    <DraftField
      error={error}
      hint={required ? "改名后，后续步骤中的引用会一并更新" : "留空则不保存结果；改名后，后续步骤中的引用会一并更新"}
      htmlFor={inputId}
      label="结果名"
      required={required}
    >
      <Input
        id={inputId}
        placeholder={required ? "如 selected" : "如 result"}
        status={error === null ? undefined : "error"}
        value={value}
        onBlur={onBlur}
        onChange={event => onChange(sanitizeKey(event.target.value))}
        onPressEnter={onPressEnter}
      />
    </DraftField>
  );
}
