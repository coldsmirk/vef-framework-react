import type { DayKind, Window, WindowRule } from "../types";

export const DAY_KINDS: Record<DayKind, string> = {
  workday: "工作日",
  rest_day: "休息日",
  holiday: "节假日"
};
export const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function shortTime(time: string): string {
  return time.endsWith(":00") && time.length === 8 ? time.slice(0, 5) : time;
}

function monthDays(values: number[]): string {
  const positive = [...new Set(values.filter(n => n > 0))].toSorted((a, b) => a - b);
  const parts: string[] = [];

  for (let i = 0; i < positive.length; i++) {
    const first = positive[i]!;
    let last = first;

    while (positive[i + 1] === last + 1) {
      last = positive[++i]!;
    }

    parts.push(first === last ? String(first) : `${first}–${last}`);
  }

  const backwards = values.filter(n => n < 0).map(n => n === -1 ? "最后一天" : `倒数第 ${-n} 天`);

  return [parts.length > 0 ? `${parts.join("、")} 日` : "", ...backwards].filter(Boolean).join("及");
}

function formatWindow(window: Window): string {
  const {
    months,
    monthDays: days,
    weekdays,
    dayKinds,
    workdayOrdinals,
    times,
    dates
  } = window;
  const parts = [
    dates && `${dates.startsAt} 至 ${dates.endsAt}`,
    months?.length && `${months.join("、")} 月`,
    days?.length && `每月 ${monthDays(days)}`,
    weekdays?.map(d => WEEKDAYS[d - 1]).join("、"),
    dayKinds?.map(k => DAY_KINDS[k]).join("、"),
    workdayOrdinals?.length && `每月${workdayOrdinals.map(n => n === -1 ? "最后一个工作日" : `${n < 0 ? "倒数" : ""}第 ${Math.abs(n)} 个工作日`).join("或")}`,
    times?.map(({ startsAt, endsAt }) => `${shortTime(startsAt)}–${endsAt < startsAt ? "次日 " : ""}${shortTime(endsAt)}`).join("、")
  ].filter(Boolean);

  return parts.join(" ") || "每天全天";
}

export function formatWindowRule(rule?: WindowRule): string {
  if (!rule) {
    return "不限时段";
  }

  const open = rule.windows.map(w => formatWindow(w)).join("；") || "未设置开放窗口";
  const closed = rule.blackouts?.map(w => formatWindow(w)).join("；");

  return [open, closed && `例外关闭：${closed}`, rule.timezone && `时区：${rule.timezone}`].filter(Boolean).join("；");
}
