import dayjs from "dayjs";

import { toDayRangeBounds } from "./search";

describe("task-center-page/toDayRangeBounds", () => {
  it("bounds the first day from midnight and the last day through its final second", () => {
    const bounds = toDayRangeBounds([dayjs("2026-09-01 14:30:00"), dayjs("2026-09-05 08:00:00")]);

    expect(bounds).toEqual(["2026-09-01 00:00:00", "2026-09-05 23:59:59"]);
  });

  it("covers the whole day when both ends pick the same day", () => {
    const bounds = toDayRangeBounds([dayjs("2026-09-10"), dayjs("2026-09-10")]);

    expect(bounds).toEqual(["2026-09-10 00:00:00", "2026-09-10 23:59:59"]);
  });

  it("clears both bounds when the range is cleared", () => {
    expect(toDayRangeBounds(null)).toEqual([undefined, undefined]);
  });
});
