import type { ReactElement } from "react";

import type { DateGranularity, DateRangeField, FieldComponentProps } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import CalendarPicker from "antd-mobile/es/components/calendar-picker";
import DatePickerView from "antd-mobile/es/components/date-picker-view";
import PickerView from "antd-mobile/es/components/picker-view";
import Popup from "antd-mobile/es/components/popup";
import { useState } from "react";

import { EditorIcon } from "../../icons";
import { FieldShell } from "../../render/parts/field-shell";
import { resolveFieldPlaceholder } from "../../render/parts/placeholder";
import {
  currentGranularityValue,
  formatGranularityTrigger,
  fromGranularityPickerDate,
  fromQuarterColumnsValue,
  PICKER_MAX_DATE,
  PICKER_MIN_DATE,
  QUARTER_PICKER_COLUMNS,
  toGranularityPickerDate,
  toQuarterColumnsValue
} from "./date-adapters";
import { PickerTrigger } from "./picker-trigger";
import { useMobileScopeContainer } from "./scope";

const EMPTY_RANGE: string[] = [];

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
  color: globalCssVars.colorPrimaryText,
  fontWeight: 500,

  "&:disabled": {
    color: globalCssVars.colorTextDisabled,
    cursor: "not-allowed"
  }
});

const endpointsRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "12px 16px 4px"
});

const endpointButtonCss = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "8px 10px",
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  background: globalCssVars.colorBgContainer,
  color: globalCssVars.colorText,
  font: "inherit",
  cursor: "pointer"
});

const endpointActiveCss = css({
  borderColor: globalCssVars.colorPrimary,
  background: globalCssVars.colorPrimaryBg,
  color: globalCssVars.colorPrimaryText
});

const endpointLabelCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextSecondary
});

const endpointSeparatorCss = css({
  flexShrink: 0,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const rangeErrorCss = css({
  padding: "4px 16px 0",
  textAlign: "center",
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorError
});

/**
 * Seed the calendar's `[Date, Date]` selection from the stored `[start, end]`
 * pair. Returns `null` (no preselection) unless both endpoints are present and
 * parseable under day granularity, matching the PC field's semantics.
 */
function toDayRange(value: string[]): [Date, Date] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const start = toGranularityPickerDate(value[0] ?? "", "day");
  const end = toGranularityPickerDate(value[1] ?? "", "day");
  return start && end ? [start, end] : null;
}

/**
 * Mobile renderer for the date-range field across every {@link DateGranularity}.
 *
 * - `day` (default): keeps antd-mobile's `CalendarPicker` in range mode.
 * - `year` / `quarter` / `month`: opens a bottom `Popup` with a two-endpoint
 * switcher (`开始` / `结束`) driving a `DatePickerView` (`year` / `month`) or
 * two-column `PickerView` (`quarter`), refusing inverted ranges (`start > end`).
 */
export function MobileDateRangeInput({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value = EMPTY_RANGE,
  onChange
}: FieldComponentProps<DateRangeField, string[]>): ReactElement {
  const [visible, setVisible] = useState(false);
  const [activeEnd, setActiveEnd] = useState<"start" | "end">("start");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const getContainer = useMobileScopeContainer();

  const granularity: DateGranularity = field.granularity ?? "day";
  const title = field.label ?? "日期区间";
  const start = formatGranularityTrigger(value[0] ?? "", granularity);
  const end = formatGranularityTrigger(value[1] ?? "", granularity);
  const display = start && end ? `${start} 至 ${end}` : "";
  const rangeInverted = draftStart.length > 0 && draftEnd.length > 0 && draftStart > draftEnd;

  const handleOpen = (): void => {
    if (granularity !== "day") {
      const seed = currentGranularityValue(granularity);
      setDraftStart(start || seed);
      setDraftEnd(end || seed);
      setActiveEnd("start");
    }

    setVisible(true);
  };

  const updateActiveDraft = (next: string): void => {
    if (!next) {
      return;
    }

    if (activeEnd === "start") {
      setDraftStart(next);
    } else {
      setDraftEnd(next);
    }
  };

  const handleConfirmGranular = (): void => {
    if (!draftStart || !draftEnd || draftStart > draftEnd) {
      return;
    }

    onChange([draftStart, draftEnd]);
    setVisible(false);
  };

  const activeDraft = activeEnd === "start" ? draftStart : draftEnd;

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
        hasError={Boolean(errors?.length)}
        placeholder={resolveFieldPlaceholder(field)}
        trailing={<EditorIcon name="calendar-range" />}
        // Clearable by default, matching the PC RangePicker (allowClear default-on);
        // a stored `allowClear: false` drops the affordance. Clearing commits the
        // cleared range shape `[]`.
        onClear={(field.allowClear ?? true) ? () => onChange(EMPTY_RANGE) : undefined}
        onOpen={handleOpen}
      />

      {granularity === "day"
        ? (
            <CalendarPicker
              getContainer={getContainer}
              selectionMode="range"
              title={title}
              value={toDayRange(value)}
              visible={visible}
              onClose={() => setVisible(false)}
              onConfirm={range => onChange(
                range
                  ? [fromGranularityPickerDate(range[0], "day"), fromGranularityPickerDate(range[1], "day")]
                  : EMPTY_RANGE
              )}
            />
          )
        : (
            <Popup
              closeOnMaskClick
              getContainer={getContainer}
              position="bottom"
              visible={visible}
              onClose={() => setVisible(false)}
            >
              <div css={popupHeaderCss}>
                <button css={popupActionCss} type="button" onClick={() => setVisible(false)}>取消</button>
                <span css={popupTitleCss}>{title}</span>

                <button
                  css={[popupActionCss, popupConfirmCss]}
                  disabled={rangeInverted}
                  type="button"
                  onClick={handleConfirmGranular}
                >
                  确定
                </button>
              </div>

              <div css={endpointsRowCss}>
                <button
                  aria-pressed={activeEnd === "start"}
                  css={[endpointButtonCss, activeEnd === "start" && endpointActiveCss]}
                  type="button"
                  onClick={() => setActiveEnd("start")}
                >
                  <span css={endpointLabelCss}>开始</span>
                  <span>{draftStart}</span>
                </button>

                <span css={endpointSeparatorCss}>至</span>

                <button
                  aria-pressed={activeEnd === "end"}
                  css={[endpointButtonCss, activeEnd === "end" && endpointActiveCss]}
                  type="button"
                  onClick={() => setActiveEnd("end")}
                >
                  <span css={endpointLabelCss}>结束</span>
                  <span>{draftEnd}</span>
                </button>
              </div>

              {rangeInverted
                ? <div css={rangeErrorCss}>结束时间不能早于开始时间</div>
                : null}

              {granularity === "quarter"
                ? (
                    <PickerView
                      columns={QUARTER_PICKER_COLUMNS}
                      value={toQuarterColumnsValue(activeDraft)}
                      onChange={columns => updateActiveDraft(fromQuarterColumnsValue(columns))}
                    />
                  )
                : (
                    <DatePickerView
                      max={PICKER_MAX_DATE}
                      min={PICKER_MIN_DATE}
                      precision={granularity}
                      value={toGranularityPickerDate(activeDraft, granularity) ?? PICKER_MIN_DATE}
                      onChange={date => updateActiveDraft(fromGranularityPickerDate(date, granularity))}
                    />
                  )}
            </Popup>
          )}
    </FieldShell>
  );
}
