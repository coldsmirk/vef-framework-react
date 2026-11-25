import type { FieldOption } from "../../types";

import { act, renderHook } from "@testing-library/react";

import { useOptionTreeExpansion } from "./use-option-tree-expansion";

const OPTIONS: FieldOption[] = [
  {
    label: "华东大区",
    value: "east",
    children: [{ label: "上海市", value: "sh" }]
  },
  {
    label: "华北大区",
    value: "north",
    children: [{ label: "北京市", value: "bj" }]
  }
];

describe("useOptionTreeExpansion", () => {
  it("keeps the searched rows expanded while the popup closes", () => {
    const { result } = renderHook(() => useOptionTreeExpansion(OPTIONS, []));

    act(() => result.current.onOpenChange(true));
    act(() => result.current.setSearchValue("上海"));
    expect(result.current.expandedKeys).toEqual(["east"]);

    act(() => result.current.onOpenChange(false));
    expect(result.current.searchValue).toBe("");
    expect(result.current.expandedKeys).toEqual(["east"]);
  });

  it("expands to the selected values on the next open, whatever was searched before", () => {
    const { result } = renderHook(() => useOptionTreeExpansion(OPTIONS, ["bj"]));

    act(() => result.current.onOpenChange(true));
    act(() => result.current.setSearchValue("上海"));
    act(() => result.current.onOpenChange(false));
    act(() => result.current.onOpenChange(true));

    expect(result.current.visibleOptions).toBe(OPTIONS);
    expect(result.current.expandedKeys).toEqual(["north"]);
  });
});
