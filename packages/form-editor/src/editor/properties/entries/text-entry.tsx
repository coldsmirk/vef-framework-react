import type { ChangeEvent, FC } from "react";

import type { EntryComponentProps } from "../../../types";

import { Input } from "@vef-framework-react/components";

import { coerceToString } from "./coerce";
import { EntryField } from "./entry-field";

export const TextEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  onChange
}) => {
  const value = coerceToString(entry.read(field));

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value);
  };

  return (
    <EntryField description={entry.description} label={entry.label}>
      <Input
        disabled={entry.readOnly}
        placeholder={entry.placeholder}
        value={value}
        onChange={handleChange}
      />
    </EntryField>
  );
};
