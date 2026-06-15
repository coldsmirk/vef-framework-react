import type { CSSProperties, ReactNode } from "react";

import type { Size } from "../_base";
import type { DynamicIconName } from "../dynamic-icon";
import type { GenericSelectRef, GenericSelectStatus, GenericSelectVariant } from "../generic-select";

/**
 * The icon-picker value. Accepts any known lucide icon name (with editor
 * autocomplete) as well as a bare `string`, since persisted/backend data is an
 * untyped icon name that may not be in the current lucide set — an unknown name
 * renders a fallback glyph rather than breaking.
 */
export type IconPickerValue = DynamicIconName | (string & {});

/**
 * Imperative handle exposed through `ref`, identical to the underlying
 * {@link GenericSelectRef}.
 */
export type IconPickerRef = GenericSelectRef;

/**
 * Props for the {@link IconPicker}. A searchable popup grid for choosing a
 * lucide icon, built on {@link GenericSelect}. The value is the kebab-case icon
 * name (e.g. `"layout-dashboard"`) — a plain string that survives a JSON
 * round-trip and is rendered elsewhere through `DynamicIcon`.
 */
export interface IconPickerProps {
  /**
   * The selected icon name, or `null`/`undefined` when unset.
   */
  value?: IconPickerValue | null;
  /**
   * Initial value for the uncontrolled mode. Ignored when `value` is provided.
   */
  defaultValue?: IconPickerValue;
  /**
   * Fired when an icon is picked, or `null` when cleared. The value can be any
   * lucide name the user picks; it is the same `IconPickerValue` shape as
   * {@link IconPickerProps.value}, not narrowed to known names.
   */
  onChange?: (value: IconPickerValue | null) => void;
  /**
   * Fired when the control loses focus.
   */
  onBlur?: () => void;

  /**
   * Placeholder shown when no icon is selected.
   */
  placeholder?: ReactNode;
  /**
   * Density preset matching the VEF size token.
   *
   * @default "medium"
   */
  size?: Size;
  /**
   * Validation status, mirroring antd's `<Select status>`.
   */
  status?: GenericSelectStatus;
  /**
   * Visual variant of the trigger.
   *
   * @default "outlined"
   */
  variant?: GenericSelectVariant;
  /**
   * Disable the control.
   *
   * @default false
   */
  disabled?: boolean;
  /**
   * Show a clear button to reset the value.
   *
   * @default true
   */
  allowClear?: boolean;
  /**
   * Return the element the popup is rendered into. Defaults to `document.body`.
   */
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  /**
   * Additional class applied to the trigger.
   */
  className?: string;
  /**
   * Inline styles applied to the trigger.
   */
  style?: CSSProperties;
}
