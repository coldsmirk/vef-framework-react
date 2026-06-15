import type { CSSProperties, ReactNode } from "react";

import type { Size } from "../_base";

/**
 * Visual variant of the trigger, mirroring antd's `<Select variant>`.
 */
export type GenericSelectVariant = "outlined" | "filled" | "borderless" | "underlined";

/**
 * Validation status driving the trigger's border/feedback colour, mirroring
 * antd's `<Select status>`.
 */
export type GenericSelectStatus = "error" | "warning";

/**
 * The render API the base hands down to a concrete popup body. A concrete
 * selection component (icon grid, dropdown table, …) reads these to render its
 * surface and commit a value — it never touches the underlying antd `Select`.
 */
export interface GenericSelectPopupApi<TValue> {
  /**
   * The currently selected value, or `null` when unset. Use it to highlight the
   * active cell/row in the popup.
   */
  value: TValue | null;
  /**
   * The debounced search keyword typed into the trigger's search box, or `""`
   * when not searching. The popup filters its content against this.
   */
  keyword: string;
  /**
   * Whether the popup is currently open. Useful for deferring expensive popup
   * work (data fetches, virtualization measurement) until first open.
   */
  open: boolean;
  /**
   * Commit a value. Forwards to {@link GenericSelectProps.onChange}. Does NOT
   * close the popup — call {@link GenericSelectPopupApi.close} as well for the
   * common "pick then dismiss" flow.
   */
  select: (value: TValue) => void;
  /**
   * Close the popup without changing the value.
   */
  close: () => void;
}

/**
 * Imperative handle exposed through `ref`.
 */
export interface GenericSelectRef {
  /**
   * Move focus into the trigger.
   */
  focus: () => void;
  /**
   * Remove focus from the trigger.
   */
  blur: () => void;
}

/**
 * Props for the {@link GenericSelect} abstract base. It owns the antd
 * `Select`-styled trigger (value display, size/status/variant/clear/disabled),
 * the controlled open state, the search box, and the popup container; concrete
 * components supply only the popup body ({@link GenericSelectProps.renderPopup})
 * and how the selected value renders ({@link GenericSelectProps.renderLabel}).
 *
 * `TValue` is the selectable value — it is forwarded to the underlying antd
 * `Select` as its value, so it must be a `string` or `number`.
 */
export interface GenericSelectProps<TValue extends string | number = string> {
  /**
   * The selected value, or `null`/`undefined` when unset (renders the placeholder).
   */
  value?: TValue | null;
  /**
   * Fired when a value is committed from the popup, or `null` when cleared.
   */
  onChange?: (value: TValue | null) => void;
  /**
   * Fired when the trigger loses focus. Wire this to drive form `touched` state.
   */
  onBlur?: () => void;

  /**
   * Controlled open state of the popup. Omit for uncontrolled behaviour.
   */
  open?: boolean;
  /**
   * Initial open state for the uncontrolled mode. Ignored when `open` is provided.
   *
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Fired when the popup opens or closes.
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * Render the popup body. Receives a {@link GenericSelectPopupApi} to read the
   * current value/keyword/open state and to commit or dismiss a selection.
   */
  renderPopup: (api: GenericSelectPopupApi<TValue>) => ReactNode;
  /**
   * Render the selected value inside the trigger. Defaults to the raw value.
   */
  renderLabel?: (value: TValue) => ReactNode;

  /**
   * Show the search box in the trigger and forward the keyword to the popup.
   *
   * @default true
   */
  searchable?: boolean;

  /**
   * Placeholder shown when no value is selected.
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
   * Show a clear button to reset the value to `null`.
   *
   * @default false
   */
  allowClear?: boolean;
  /**
   * Render the trigger in a loading state.
   *
   * @default false
   */
  loading?: boolean;
  /**
   * Custom suffix icon for the trigger. While the popup is open and `searchable`,
   * a search icon is shown instead.
   */
  suffixIcon?: ReactNode;
  /**
   * Content rendered before the value inside the trigger.
   */
  prefix?: ReactNode;

  /**
   * Return the element the popup is rendered into. Defaults to `document.body`.
   * Pass a scoped container (e.g. the form-editor phone shell) to contain the
   * popup within it.
   */
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  /**
   * Whether the popup width matches the trigger width. Defaults to `false` so a
   * popup body wider than the trigger (e.g. an icon grid) is not constrained.
   *
   * @default false
   */
  popupMatchSelectWidth?: boolean | number;
  /**
   * Additional class applied to the popup root.
   */
  popupClassName?: string;

  /**
   * Additional class applied to the trigger.
   */
  className?: string;
  /**
   * Inline styles applied to the trigger.
   */
  style?: CSSProperties;
}
