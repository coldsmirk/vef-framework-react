export type DayKind = "workday" | "rest_day" | "holiday";

export interface Day {
  /**
   * Calendar date (YYYY-MM-DD).
   */
  date: string;
  kind: DayKind;
  name?: string;
}

export interface DateRange {
  /**
   * Inclusive calendar dates (YYYY-MM-DD).
   */
  startsAt: string;
  endsAt: string;
}

export interface TimeRange {
  /**
   * Local wall times (HH:mm:ss). An earlier end crosses midnight.
   */
  startsAt: string;
  endsAt: string;
}

export interface Window {
  months?: number[];
  monthDays?: number[];
  weekdays?: number[];
  dayKinds?: DayKind[];
  workdayOrdinals?: number[];
  times?: TimeRange[];
  dates?: DateRange;
}

export interface WindowRule {
  timezone?: string;
  windows: Window[];
  blackouts?: Window[];
}

export interface Interval {
  /**
   * An omitted bound extends beyond the server search horizon on that side.
   */
  startsAtUnixMs?: number;
  endsAtUnixMs?: number;
}

export interface WindowStatus {
  open: boolean;
  current?: Interval;
  next?: Interval;
}

export interface PreviewWindowsParams {
  rule: WindowRule;
  from?: number;
  limit?: number;
}

export interface PreviewWindowsResult {
  status: WindowStatus;
  windows: Interval[];
}
