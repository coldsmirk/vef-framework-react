import type { PickerColumn, PickerValue } from "antd-mobile/es/components/picker";
import type { FC } from "react";

import type { FieldComponentProps, SelectField } from "../../types";

import Picker from "antd-mobile/es/components/picker";
import { useMemo, useState } from "react";

import { EditorIcon } from "../../icons";
import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell } from "../../render/parts/field-shell";
import { PickerTrigger } from "./picker-trigger";
import { useMobileScopeContainer } from "./scope";

/**
 * Mobile counterpart of `select-field`. Mirrors `FieldComponentProps<SelectField,
 * string | number | undefined>` — same value contract as the PC component
 * (scalar option value, `""` when cleared) — and resolves options through the
 * shared `useFieldOptions`. The control differs only in surface: a tappable
 * trigger opening an antd-mobile `Picker`. The Picker's value is an array (one
 * entry per column); with a single column we adapt scalar ⇄ single-element array
 * at the boundary and commit `value[0] ?? ""` on confirm.
 */
export const MobileSelectInput: FC<FieldComponentProps<SelectField, string | number | undefined>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}) => {
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);
  const getContainer = useMobileScopeContainer();
  const [visible, setVisible] = useState(false);

  const hasValue = value !== "" && value !== undefined;
  const selected = hasValue ? options.find(option => option.value === value) : undefined;
  // Stable references so the controlled Picker isn't fed fresh column/value
  // arrays on every parent form re-render (which can thrash its open wheel).
  const columns = useMemo<PickerColumn[]>(
    () => [options.map(option => { return { label: option.label, value: option.value }; })],
    [options]
  );
  const pickerValue = useMemo<PickerValue[]>(() => hasValue ? [value] : [], [hasValue, value]);
  const hasError = (errors?.length ?? 0) > 0 || error;
  // The closed trigger is the only on-screen surface, so it carries the remote
  // source's transient state: a muted loading hint, or a failure note when the
  // resolver rejected and left nothing to pick.
  let triggerPlaceholder = field.placeholder ?? "请选择";

  if (loading) {
    triggerPlaceholder = "加载中…";
  } else if (error && options.length === 0) {
    triggerPlaceholder = "选项加载失败";
  }

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "下拉选择"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <PickerTrigger
        disabled={disabled}
        display={selected?.label ?? ""}
        domId={domId}
        hasError={hasError}
        placeholder={triggerPlaceholder}
        trailing={<EditorIcon name="chevron-down" />}
        // Mirrors the PC select: clearable only when the field opts in via
        // `allowClear`; clearing commits the same `""` the PC control writes.
        onClear={field.allowClear ? () => onChange("") : undefined}
        onOpen={() => setVisible(true)}
      />

      <Picker
        columns={columns}
        getContainer={getContainer}
        loading={loading}
        title={field.label ?? "下拉选择"}
        value={pickerValue}
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={next => onChange(next[0] ?? "")}
      />
    </FieldShell>
  );
};
