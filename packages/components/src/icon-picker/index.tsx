import type { PropsWithRef } from "../_base";
import type { DynamicIconName } from "../dynamic-icon";
import type { IconPickerProps, IconPickerRef } from "./props";

import { css } from "@emotion/react";
import { useState } from "react";

import { globalCssVars } from "../_base";
import { DynamicIcon } from "../dynamic-icon";
import { GenericSelect } from "../generic-select";
import { ICON_GRID_WIDTH, IconGrid } from "./icon-grid";

const labelStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: globalCssVars.spacingXs,
  minWidth: 0,
  maxWidth: "100%",
  // antd centers the selection item via line-height, against which an inline-flex
  // box would otherwise align by its (icon-derived) baseline and sit too high.
  // `middle` centers the whole label within the line box instead.
  verticalAlign: "middle"
});

const labelIconStyle = css({
  flex: "none",
  display: "inline-flex",
  fontSize: "1.1em"
});

const labelTextStyle = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

function renderIconLabel(name: string) {
  return (
    <span css={labelStyle}>
      <span css={labelIconStyle}>
        <DynamicIcon name={name as DynamicIconName} />
      </span>

      <span css={labelTextStyle}>{name}</span>
    </span>
  );
}

/**
 * A searchable popup grid for choosing a lucide icon, built on
 * {@link GenericSelect}. The value is the kebab-case icon name (e.g.
 * `"layout-dashboard"`); the trigger previews the selected icon alongside its
 * name, and unknown names fall back to a placeholder glyph rather than breaking.
 *
 * Works both as a standalone controlled/uncontrolled input and, via
 * `IconPickerField`, inside the VEF form.
 */
export function IconPicker(props: PropsWithRef<IconPickerRef, IconPickerProps>) {
  const {
    ref,
    value,
    defaultValue,
    onChange,
    onBlur,
    placeholder,
    size,
    status,
    variant,
    disabled,
    allowClear = true,
    getPopupContainer,
    className,
    style
  } = props;

  // Controlled when a `value` prop is supplied — detected by key presence, not
  // `value !== undefined`. A form-bound control receives a `value` that
  // legitimately starts (and resets to) `undefined`; keying off the value would
  // strand the trigger on a stale icon after an external `resetField`, while
  // requiring `defaultValue` would block the bare uncontrolled "start empty" use.
  const isControlled = "value" in props;
  const [internalValue, setInternalValue] = useState<string | null>(defaultValue ?? null);
  const currentValue = isControlled ? value ?? null : internalValue;

  const handleChange = (next: string | null) => {
    if (!isControlled) {
      setInternalValue(next);
    }

    onChange?.(next);
  };

  return (
    <GenericSelect<string>
      ref={ref}
      allowClear={allowClear}
      className={className}
      disabled={disabled}
      getPopupContainer={getPopupContainer}
      placeholder={placeholder}
      popupMatchSelectWidth={ICON_GRID_WIDTH}
      renderLabel={renderIconLabel}
      size={size}
      status={status}
      style={style}
      value={currentValue}
      variant={variant}
      renderPopup={({
        value: popupValue,
        keyword,
        select,
        close
      }) => (
        <IconGrid
          keyword={keyword}
          value={popupValue}
          onClose={close}
          onSelect={select}
        />
      )}
      onBlur={onBlur}
      onChange={handleChange}
    />
  );
}

export type { IconPickerProps, IconPickerRef, IconPickerValue } from "./props";
