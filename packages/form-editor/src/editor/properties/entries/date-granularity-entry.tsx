import type { FC } from "react";

import type { DateGranularity, EntryComponentProps } from "../../../types";

import { Popconfirm, Select } from "@vef-framework-react/components";
import { isDateGranularity } from "@vef-framework-react/shared";

import { DATE_GRANULARITY_OPTIONS, isDateGranularityField } from "../../../engine/schema/date-granularity";
import { hasDateGranularityLiterals, useFormEditorStore, useFormEditorStoreApi } from "../../../store/form-store";
import { useConfirmableKindSwitch } from "../use-confirmable-kind-switch";
import { EntryField } from "./entry-field";

const selectStyle = { width: "100%" } as const;

/**
 * Property entry for a `date` or `daterange` field's `granularity`（「精度」）.
 *
 * Switching granularity changes the field's value format (`YYYY` / `YYYY-Qn` /
 * `YYYY-MM` / `YYYY-MM-DD`), so any linkage literal targeting the field becomes
 * incompatible. When none exist the switch commits immediately; otherwise it
 * gates behind a confirmation (`useConfirmableKindSwitch`), then delegates to
 * the store's `setDateGranularity` action so the field, its cross-device twin,
 * and every incompatible linkage literal update in one undoable step.
 */
export const DateGranularityEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  schema,
  onChange
}) => {
  const storeApi = useFormEditorStoreApi();
  const device = useFormEditorStore(state => state.device);
  const raw = entry.read(field);
  const current: DateGranularity = isDateGranularity(raw) ? raw : "day";
  const dateField = isDateGranularityField(field) ? field : undefined;
  const needsConfirm = dateField ? hasDateGranularityLiterals(schema, device, dateField.id) : false;

  const commit = (nextGranularity: DateGranularity): void => {
    if (!dateField) {
      onChange(nextGranularity);
      return;
    }

    storeApi.getState().setDateGranularity({
      fieldId: dateField.id,
      granularity: nextGranularity
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
