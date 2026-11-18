import type { WindowStatus } from "../types";

import { Tag } from "@vef-framework-react/components";

import { WEEKDAYS } from "./format-window-rule";

const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

export function WindowStatusTag({ status }: { status: WindowStatus }) {
  if (status.open) {
    const end = status.current?.endsAtUnixMs;

    return <Tag color="success">{end === undefined ? "长期开放" : `开放中 · ${timeFormat.format(end)} 截止`}</Tag>;
  }

  if (status.next?.startsAtUnixMs === undefined) {
    return <Tag>近期不开放</Tag>;
  }

  const start = new Date(status.next.startsAtUnixMs);
  const weekday = WEEKDAYS[(start.getDay() + 6) % 7];

  return <Tag>{`下次开放：${start.getMonth() + 1} 月 ${start.getDate()} 日（${weekday}）${timeFormat.format(start)}`}</Tag>;
}
