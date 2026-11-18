import type { DateRange, Day, PreviewWindowsParams, PreviewWindowsResult } from "@vef-framework-react/calendar";

import { defineMock } from "../define-mock";

const dayMs = 86_400_000;
const overrides = new Map<string, Day>();
const demoHoliday = new Date(Date.now() + dayMs).toISOString().slice(0, 10);
const holidays = new Map([["01-01", "元旦"], ["05-01", "劳动节"], ["10-01", "国庆节"]]);

function calendarDay(instant: Date): Day {
  const date = instant.toISOString().slice(0, 10);
  const override = overrides.get(date);

  if (override) {
    return override;
  }

  const name = date === demoHoliday ? "园区休假日" : holidays.get(date.slice(5));
  const weekend = [0, 6].includes(instant.getUTCDay());
  return {
    date,
    kind: name ? "holiday" : weekend ? "rest_day" : "workday",
    name
  };
}

defineMock<DateRange>("sys/calendar", "find_days", ({ params }) => {
  const days: Day[] = [];
  const end = Date.parse(params.endsAt);

  for (let time = Date.parse(params.startsAt); time <= end; time += dayMs) {
    days.push(calendarDay(new Date(time)));
  }

  return days;
});
defineMock<{ overrides: Day[] }>("sys/calendar", "save_overrides", ({ params }) => {
  for (const day of params.overrides) {
    overrides.set(day.date, day);
  }

  return null;
});
defineMock<{ dates: string[] }>("sys/calendar", "delete_overrides", ({ params }) => {
  for (const date of params.dates) {
    overrides.delete(date);
  }

  return null;
});

// Example server output. Rule evaluation belongs to sys/calendar.
defineMock<PreviewWindowsParams, PreviewWindowsResult>("sys/calendar", "preview_windows", ({ params }) => {
  const start = Date.parse(`${demoHoliday}T09:00:00+08:00`);
  const windows = [0, 1, 2].slice(0, params.limit).map(offset => {
    const startsAtUnixMs = start + offset * dayMs;
    return { startsAtUnixMs, endsAtUnixMs: startsAtUnixMs + 8 * 3_600_000 };
  });
  return { status: { open: false, next: windows[0] }, windows };
});
