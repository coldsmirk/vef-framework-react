import type { FC } from "react";

import type { EntryComponentProps } from "../../../types";

import { Select } from "@vef-framework-react/components";

import { coerceToString } from "./coerce";
import { EntryField } from "./entry-field";

const selectStyle = { width: "100%" } as const;

/**
 * What an unset select property reads as. Every property a select entry edits
 * is optional, and an absent value means the renderer's own default.
 */
const UNSET_PLACEHOLDER = "默认";

export const SelectEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  onChange
}) => {
  const value = coerceToString(entry.read(field));
  const options = entry.options ?? [];

  return (
    <EntryField description={entry.description} label={entry.label}>
      <Select
        // Clearing writes `undefined`, which removes the override and restores
        // the default. Without it a picked value could never be unset again.
        allowClear
        disabled={entry.readOnly}
        options={options}
        placeholder={entry.placeholder ?? UNSET_PLACEHOLDER}
        style={selectStyle}
        // An unset/empty value renders as undefined so the placeholder shows
        // instead of an empty-string selection.
        value={value.length > 0 ? value : undefined}
        onChange={next => onChange(next)}
      />
    </EntryField>
  );
};
