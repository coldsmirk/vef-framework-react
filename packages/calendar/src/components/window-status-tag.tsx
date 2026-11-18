import type { WindowStatus } from "../types";

import { Tag } from "@vef-framework-react/components";

import { WEEKDAYS } from "./format-window-rule";

const tagStyle = {
  width: "fit-content",
  maxWidth: "100%",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  alignSelf: "flex-start"
} as const;

const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

export function WindowStatusTag({ status }: { status: WindowStatus }) {
  if (status.open) {
    const end = status.current?.endsAtUnixMs;

    return <Tag color="success" style={tagStyle}>{end === undefined ? "长期开放" : `开放中 · ${timeFormat.format(end)} 截止`}</Tag>;
  }

  if (status.next?.startsAtUnixMs === undefined) {
    return <Tag style={tagStyle}>近期不开放</Tag>;
  }

  const start = new Date(status.next.startsAtUnixMs);
  const weekday = WEEKDAYS[(start.getDay() + 6) % 7];

  return <Tag style={tagStyle}>{`下次开放：${start.getMonth() + 1} 月 ${start.getDate()} 日（${weekday}）${timeFormat.format(start)}`}</Tag>;
}
