import { formatWindowRule } from "./format-window-rule";

describe("formatWindowRule", () => {
  it("distinguishes an unrestricted flow, an empty rule and a whole-day window", () => {
    expect(formatWindowRule()).toBe("不限时段");
    expect(formatWindowRule({ windows: [] })).toBe("未设置开放窗口");
    expect(formatWindowRule({ windows: [{}] })).toBe("每天全天");
  });

  it("groups consecutive month days and describes independent windows", () => {
    expect(formatWindowRule({
      windows: [
        { dayKinds: ["workday"], times: [{ startsAt: "14:00:00", endsAt: "16:00:00" }] },
        { monthDays: [2, 1, 3, -1] }
      ]
    })).toBe("工作日 14:00–16:00；每月 1–3 日及最后一天");
  });

  it("keeps date bounds, negative ordinals, overnight seconds, exceptions and timezone visible", () => {
    expect(formatWindowRule({
      timezone: "UTC",
      windows: [
        {
          dates: { startsAt: "2026-01-01", endsAt: "2026-03-31" },
          months: [1, 3],
          weekdays: [1, 7],
          workdayOrdinals: [-1, -2],
          times: [{ startsAt: "23:59:30", endsAt: "00:00:00" }]
        }
      ],
      blackouts: [{ dayKinds: ["holiday"] }]
    })).toBe(
      "2026-01-01 至 2026-03-31 1、3 月 周一、周日 每月最后一个工作日或倒数第 2 个工作日 23:59:30–次日 00:00；例外关闭：节假日；时区：UTC"
    );
  });
});
