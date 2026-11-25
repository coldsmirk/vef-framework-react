import type { ReactElement } from "react";

import { Input } from "@vef-framework-react/components";
import { useId, useState } from "react";

import { sanitizeKey } from "../../../../engine/keys";
import { isValidIdentifier } from "../../../../engine/validation";
import { DraftField } from "../../draft-modal";

/**
 * Why a step's result cannot be stored under `name`, or `null` when it can. An
 * optional result may be left unnamed, and is then not stored.
 */
export function stepOutputError(name: string, required: boolean, usedNames: ReadonlySet<string>): string | null {
  if (name.length === 0) {
    return required ? "请填写结果名，供后续步骤引用" : null;
  }

  if (!isValidIdentifier(name)) {
    return "结果名须以字母或下划线开头，仅含字母、数字和下划线";
  }

  return usedNames.has(name) ? `结果名「${name}」与本规则其它步骤重复` : null;
}

export interface StepOutputFieldProps {
  error: string | null;
  required: boolean;
  value: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onPressEnter?: () => void;
}

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

export interface StepOutputInputProps {
  required: boolean;
  usedNames: ReadonlySet<string>;
  value: string;
  onCommit: (next: string | undefined) => void;
}

/**
 * The inline form: the name is a draft while it is typed, committed on blur or
 * Enter, and dropped when it cannot be used — every commit renames the
 * references in the steps that follow, so a half-typed name must not.
 */
export function StepOutputInput({
  onCommit,
  required,
  usedNames,
  value
}: StepOutputInputProps): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const current = draft ?? value;
  const error = stepOutputError(current, required, usedNames);

  const commit = (): void => {
    setDraft(null);

    if (current !== value && error === null) {
      onCommit(current.length > 0 ? current : undefined);
    }
  };

  return (
    <StepOutputField
      error={error}
      required={required}
      value={current}
      onBlur={commit}
      onChange={setDraft}
      onPressEnter={commit}
    />
  );
}
