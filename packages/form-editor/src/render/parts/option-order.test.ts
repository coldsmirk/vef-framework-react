import type { FieldOption } from "../../types";

import { describe, expect, it } from "vitest";

import { orderByOptions } from "./option-order";

describe("orderByOptions", () => {
  const options: FieldOption[] = [
    { label: "读书", value: "read" },
    { label: "运动", value: "sport" },
    { label: "音乐", value: "music" }
  ];

  it("sorts by the option list's order, not the order given", () => {
    // antd sorts its emitted array by option index while antd-mobile appends in
    // click order, so the same two clicks produced different stored arrays on
    // the two devices — a spurious diff on every cross-device resubmit.
    expect(orderByOptions(["music", "read"], options)).toEqual(["read", "music"]);
  });

  it("drops a value the option list no longer offers", () => {
    // The backend validates a selection against the enumerated options and
    // rejects anything else, so a leftover from a removed option would fail the
    // whole submission.
    expect(orderByOptions(["read", "retired", "music"], options)).toEqual(["read", "music"]);
  });

  it("keeps numeric option values as numbers", () => {
    const numeric: FieldOption[] = [{ label: "甲", value: 1 }, { label: "乙", value: 2 }];

    expect(orderByOptions([2, 1], numeric)).toEqual([1, 2]);
  });

  it("returns an empty list for an empty selection or an empty option list", () => {
    expect(orderByOptions([], options)).toEqual([]);
    expect(orderByOptions(["read"], [])).toEqual([]);
  });
});
