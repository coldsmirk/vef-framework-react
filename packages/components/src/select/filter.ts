import type { SelectOption } from ".";

/**
 * Type-to-filter predicate for a plain option list (antd `Select`
 * `filterOption`). antd's default matches the typed query against the option
 * `value` — the stored code — so a list of `{ label: "北京", value: "bj" }`
 * filters to nothing for every word the user can actually see. Match the label
 * instead, case-insensitively and ignoring surrounding whitespace.
 *
 * The value stays out of the comparison deliberately: it is storage, not copy,
 * and matching it would let a query hit an option whose visible text does not
 * contain the query at all — including numeric codes colliding with numbers the
 * user typed for another reason.
 *
 * Pass it wherever a `Select` sets `showSearch` over options that were not built
 * by `useDataOptionsSelect` / `useCodeSetOptionsSelect`; those hooks install
 * their own pinyin-aware filter over the richer option shape they produce.
 */
export function filterOptionByLabel(input: string, option?: SelectOption): boolean {
  const query = input.trim().toLowerCase();

  if (query === "") {
    return true;
  }

  const label = option?.label;

  return typeof label === "string" && label.toLowerCase().includes(query);
}
