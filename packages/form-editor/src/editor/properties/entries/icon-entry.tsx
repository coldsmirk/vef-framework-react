import type { DynamicIconName } from "@vef-framework-react/components";
import type { FC } from "react";

import type { EntryComponentProps } from "../../../types";

import { IconPicker } from "@vef-framework-react/components";
import { isString } from "@vef-framework-react/shared";

import { EntryField } from "./entry-field";

/**
 * Property-panel renderer for the `icon` entry type: a searchable lucide
 * {@link IconPicker} whose value is the stored kebab-case icon name. Used by
 * any field that carries an icon property (e.g. a button's leading icon).
 */
export const IconEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  onChange
}) => {
  const raw = entry.read(field);
  const value = isString(raw) && raw.length > 0 ? (raw as DynamicIconName) : undefined;

  return (
    <EntryField description={entry.description} label={entry.label}>
      <IconPicker
        disabled={entry.readOnly}
        placeholder={entry.placeholder}
        value={value}
        onChange={next => onChange(next ?? undefined)}
      />
    </EntryField>
  );
};
