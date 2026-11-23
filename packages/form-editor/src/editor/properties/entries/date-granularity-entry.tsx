import type { FC } from "react";

import type { DateGranularity, EntryComponentProps } from "../../../types";

import { Popconfirm, Select } from "@vef-framework-react/components";
import { isDateGranularity } from "@vef-framework-react/shared";

import {
  DATE_GRANULARITY_OPTIONS,
  hasAuthoredDateLiteralsInSchema,
  reconcileDateGranularityInSchema
} from "../../../engine/schema/date-granularity";
import { useFormEditorStoreApi } from "../../../store/form-store";
import { useConfirmableKindSwitch } from "../use-confirmable-kind-switch";
import { EntryField } from "./entry-field";

const selectStyle = { width: "100%" } as const;
const HISTORY_LIMIT = 100;

/**
 * Property entry for a `date` or `daterange` field's `granularity`（「精度」）.
 *
 * Switching granularity changes the field's value format (`YYYY` / `YYYY-Qn` /
 * `YYYY-MM` / `YYYY-MM-DD`), so any linkage literal targeting the field becomes
 * incompatible. When none exist the switch commits immediately; otherwise it
 * gates behind a confirmation (`useConfirmableKindSwitch`), then updates the
 * field (and any same-key twin on the other device) and scrubs incompatible
 * linkage literals across the schema in one undoable step.
 */
export const DateGranularityEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  schema,
  onChange
}) => {
  const storeApi = useFormEditorStoreApi();
  const raw = entry.read(field);
  const current: DateGranularity = isDateGranularity(raw) ? raw : "day";
  const dateField = field.type === "date" || field.type === "daterange" ? field : undefined;
  const needsConfirm = dateField ? hasAuthoredDateLiteralsInSchema(schema, dateField) : false;

  const commit = (nextGranularity: DateGranularity): void => {
    if (!dateField) {
      onChange(nextGranularity);
      return;
    }

    const currentState = storeApi.getState();
    const nextSchema = reconcileDateGranularityInSchema(currentState.schema, dateField.id, nextGranularity);

    if (nextSchema === currentState.schema) {
      return;
    }

    const past = [...currentState.past, { schema: currentState.schema, device: currentState.device }];

    if (past.length > HISTORY_LIMIT) {
      past.splice(0, past.length - HISTORY_LIMIT);
    }

    storeApi.setState({
      past,
      future: [],
      schema: nextSchema
    });
  };

  const kindSwitch = useConfirmableKindSwitch<DateGranularity>({
    current,
    needsConfirm,
    commit
  });

  return (
    <EntryField description={entry.description} label={entry.label}>
      <Popconfirm
        cancelText="取消"
        okText="切换"
        open={kindSwitch.pendingKind !== null}
        title="切换精度将清空该字段关联的联动字面量值"
        onCancel={kindSwitch.cancel}
        onConfirm={kindSwitch.confirm}
      >
        <Select
          disabled={entry.readOnly}
          options={entry.options ?? DATE_GRANULARITY_OPTIONS}
          placeholder={entry.placeholder}
          style={selectStyle}
          value={current}
          onChange={value => {
            if (isDateGranularity(value)) {
              kindSwitch.requestKind(value);
            }
          }}
        />
      </Popconfirm>
    </EntryField>
  );
};
