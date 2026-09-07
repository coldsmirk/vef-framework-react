import type { FieldOption } from "../../types";

/**
 * Normalize a multi-select value to the option list's own order, keeping only
 * values the list still offers.
 *
 * The order has to be a property of the SCHEMA, not of the widget or of the
 * order the user happened to click in: antd's `Checkbox.Group` sorts its
 * emitted array by option index, while antd-mobile's appends each check in
 * click order. Left alone, the same two clicks produce `["read", "music"]` on
 * desktop and `["music", "read"]` on a phone — two different rows in
 * `form_data` for one user intent, and a spurious diff whenever someone
 * resubmits from the other device.
 *
 * Filtering to the registered values matters for the same reason on the way
 * out: the backend validates a selection against the field's enumerated
 * options and rejects anything else, so a value left over from an option the
 * designer has since removed makes the whole submission fail. antd already
 * drops those; this is what makes the mobile renderer agree.
 */
export function orderByOptions(value: readonly unknown[], options: readonly FieldOption[]): Array<string | number> {
  const positions = new Map(options.map((option, index) => [option.value, index]));

  return value
    .filter((item): item is string | number => positions.has(item as string | number))
    .toSorted((a, b) => (positions.get(a) ?? 0) - (positions.get(b) ?? 0));
}
