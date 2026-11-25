import type { CheckListValue } from "antd-mobile/es/components/check-list";
import type { FC } from "react";

import type { FieldComponentProps, MultiSelectField } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import CheckList from "antd-mobile/es/components/check-list";
import Popup from "antd-mobile/es/components/popup";
import { useMemo, useState } from "react";

import { toTopLevelOptions } from "../../engine/options";
import { EditorIcon } from "../../icons";
import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell } from "../../render/parts/field-shell";
import { OptionsStatus } from "../../render/parts/options-status";
import { resolveFieldPlaceholder } from "../../render/parts/placeholder";
import { PickerTrigger } from "./picker-trigger";
import { useMobileScopeContainer } from "./scope";

const EMPTY_VALUE: Array<string | number> = [];

const popupHeaderCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 16px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const popupTitleCss = css({
  flex: 1,
  minWidth: 0,
  textAlign: "center",
  fontWeight: 500,
  color: globalCssVars.colorText,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const popupActionCss = css({
  flexShrink: 0,
  padding: "2px 4px",
  border: "none",
  background: "transparent",
  font: "inherit",
  color: globalCssVars.colorTextSecondary,
  cursor: "pointer"
});

const popupConfirmCss = css({
  color: globalCssVars.colorPrimary,
  fontWeight: 500
});

const popupBodyCss = css({
  maxHeight: "55vh",
  overflowY: "auto"
});

const popupStatusCss = css({
  padding: "24px 16px",
  textAlign: "center"
});

/**
 * Mobile counterpart of `multi-select-field`. antd-mobile has no multi-select
 * picker, so this layers a `Popup` + multiple `CheckList` behind the shared
 * `PickerTrigger` / `useMobileScopeContainer` pattern (`MobileSelectInput` is
 * the model). Honors `maxCount` (disabling unselected items once the cap is
 * reached while still allowing unchecking), shows selected labels with the
 * raw-value fallback when an option is missing, and commits `[]` on clear.
 */
export const MobileMultiSelectInput: FC<FieldComponentProps<MultiSelectField, Array<string | number>>> = ({
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
    options: rawOptions
  } = useFieldOptions(field.dataSource);
  const options = useMemo(() => toTopLevelOptions(rawOptions), [rawOptions]);
  const getContainer = useMobileScopeContainer();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<CheckListValue[]>(EMPTY_VALUE);

  const current = Array.isArray(value) ? value : EMPTY_VALUE;
  const maxCount = field.maxCount !== undefined && field.maxCount > 0 ? field.maxCount : undefined;
  const optionLabels = useMemo(
    () => new Map(options.map(option => [option.value, option.label])),
    [options]
  );

  // Falls back to the raw value for each selected entry whose option is
  // missing (in-flight / failed remote source, retired option), matching
  // MobileSelectInput and PC Select so held values stay visible and clearable.
  const display = current.length > 0
    ? current.map(item => optionLabels.get(item) ?? String(item)).join("、")
    : "";
  const hasError = (errors?.length ?? 0) > 0 || error;

  let triggerPlaceholder = resolveFieldPlaceholder(field);

  if (loading) {
    triggerPlaceholder = "加载中…";
  } else if (error && options.length === 0) {
    triggerPlaceholder = "选项加载失败";
  }

  const draftSet = useMemo(() => new Set<CheckListValue>(draft), [draft]);
  const limitReached = maxCount !== undefined && draft.length >= maxCount;
  const title = field.label ?? "下拉多选";

  const handleOpen = () => {
    setDraft(current);
    setVisible(true);
  };

  const handleClose = () => {
    setVisible(false);
  };

  const handleDraftChange = (next: CheckListValue[]) => {
    if (maxCount !== undefined && next.length > maxCount && next.length > draft.length) {
      return;
    }

    setDraft(next);
  };

  const handleConfirm = () => {
    onChange(draft.length > 0 ? [...draft] : []);
    setVisible(false);
  };

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={title}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <PickerTrigger
        disabled={disabled}
        display={display}
        domId={domId}
        hasError={hasError}
        placeholder={triggerPlaceholder}
        trailing={<EditorIcon name="chevron-down" />}
        onClear={field.allowClear ? () => onChange([]) : undefined}
        onOpen={handleOpen}
      />

      <Popup
        closeOnMaskClick
        getContainer={getContainer}
        position="bottom"
        visible={visible}
        onClose={handleClose}
      >
        <div css={popupHeaderCss}>
          <button css={popupActionCss} type="button" onClick={handleClose}>取消</button>
          <span css={popupTitleCss}>{title}</span>
          <button css={[popupActionCss, popupConfirmCss]} type="button" onClick={handleConfirm}>确定</button>
        </div>

        <div css={popupBodyCss}>
          {options.length > 0
            ? (
                <CheckList multiple value={draft} onChange={handleDraftChange}>
                  {options.map(option => (
                    <CheckList.Item
                      key={option.value}
                      description={option.description}
                      disabled={option.disabled === true || (limitReached && !draftSet.has(option.value))}
                      value={option.value}
                    >
                      {option.label}
                    </CheckList.Item>
                  ))}
                </CheckList>
              )
            : (
                <div css={popupStatusCss}>
                  <OptionsStatus error={error} loading={loading} />
                </div>
              )}
        </div>
      </Popup>
    </FieldShell>
  );
};
