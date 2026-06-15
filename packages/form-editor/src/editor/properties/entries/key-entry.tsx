import type { ChangeEvent, FC } from "react";

import type { EntryComponentProps } from "../../../types";

import { Input } from "@vef-framework-react/components";
import { useState } from "react";

import { coerceToString } from "./coerce";
import { EntryField } from "./entry-field";

/**
 * Property-panel renderer for the `key` entry type: a draft-buffered text input.
 * The committed value flows through the store's `setFieldKey`, which sanitizes
 * (strips every non-key char) and de-duplicates within the value scope —
 * normalization that is only coherent once per committed value. A plain
 * controlled input would re-render off the already-normalized stored key on
 * every keystroke, stripping characters and jumping the caret as the user types.
 * Buffering the draft and committing on blur / Enter (the seed-on-transition
 * pattern the variable-name editor uses) keeps the normalization off the typing
 * path; commit semantics are identical to a per-keystroke write.
 */
export const KeyEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  onChange
}) => {
  const committed = coerceToString(entry.read(field));
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (): void => {
    if (draft !== null) {
      onChange(draft);
      setDraft(null);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setDraft(event.target.value);
  };

  return (
    <EntryField description={entry.description} label={entry.label}>
      <Input
        disabled={entry.readOnly}
        placeholder={entry.placeholder}
        value={draft ?? committed}
        onBlur={commit}
        onChange={handleChange}
        onFocus={() => setDraft(committed)}
        onPressEnter={commit}
      />
    </EntryField>
  );
};
