import type { FC } from "react";

import type { EntryComponentProps } from "../../../types";

import { InputNumber } from "@vef-framework-react/components";

import { EntryField } from "./entry-field";

const inputStyle = { width: "100%" } as const;

function coerceToNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export const NumberEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  onChange
}) => {
  const value = coerceToNumber(entry.read(field));

  return (
    <EntryField description={entry.description} label={entry.label}>
      <InputNumber
        disabled={entry.readOnly}
        placeholder={entry.placeholder}
        style={inputStyle}
        value={value}
        onChange={next => onChange(typeof next === "number" ? next : undefined)}
      />
    </EntryField>
  );
};
