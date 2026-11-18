import type { DateRange, Day, Interval, WindowRule } from "../types";

import { Alert, Flex, Labeled, Spin, Stack, Tag, Text } from "@vef-framework-react/components";
import { useQueries, useQuery } from "@vef-framework-react/core";
import { useEffect, useMemo, useState } from "react";

import { useCalendarApi } from "../api";
import { windowRuleIssue } from "./window-rule-issue";

function calendarDateFormatter(timeZone?: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone });
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }

    // Go's zoneinfo can name zones the browser does not recognize.
    return new Intl.DateTimeFormat("en-CA");
  }
}

function PreviewIntervals({
  windows,
  timezone,
  from
}: { windows: Interval[]; timezone?: string; from: number }) {
  const api = useCalendarApi();
  // Go also accepts Local for the server timezone. Show those instants in the viewer’s zone.
  const date = calendarDateFormatter(timezone === "Local" ? undefined : timezone);
  const display = new Intl.DateTimeFormat("zh-CN", {
    timeZone: date.resolvedOptions().timeZone,
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: windows.some(w => (w.startsAtUnixMs ?? 0) % 60_000 !== 0 || (w.endsAtUnixMs ?? 0) % 60_000 !== 0) ? "2-digit" : undefined,
    hourCycle: "h23"
  });
  const intervals = windows.map(interval => {
    const { startsAtUnixMs: start, endsAtUnixMs: end } = interval;
    const startLabel = start === undefined ? "此前已开放" : display.format(start);
    const endLabel = end === undefined ? "长期开放" : display.format(end);
    // Only annotate the visible dates of an unbounded window. No artificial
    // timestamp is shown as a window boundary.
    const firstDate = start ?? from;

    return {
      key: start ?? "before",
      label: [startLabel, endLabel].join(start === undefined || end === undefined ? " · " : " 至 "),
      startsAt: date.format(firstDate),
      endsAt: date.format(end === undefined ? firstDate : end - 1)
    };
  });
  // Query only the covered dates, in at most one legal request per calendar year.
  const years = new Map<string, DateRange>();

  for (const { startsAt, endsAt } of intervals) {
    for (let year = Number(startsAt.slice(0, 4)); year <= Number(endsAt.slice(0, 4)); year++) {
      const key = String(year);
      const start = startsAt.startsWith(key) ? startsAt : `${key}-01-01`;
      const end = endsAt.startsWith(key) ? endsAt : `${key}-12-31`;
      const existing = years.get(key);
      years.set(key, {
        startsAt: existing && existing.startsAt < start ? existing.startsAt : start,
        endsAt: existing && existing.endsAt > end ? existing.endsAt : end
      });
    }
  }

  const results = useQueries({
    queries: years.values().map(range => {
      return {
        queryFn: api.findCalendarDays,
        queryKey: [api.findCalendarDays.key, range] as const
      };
    }).toArray()
  });
  const holidays: Day[] = results.flatMap(result => result.data ?? []).filter(day => day.kind === "holiday");
  const dayError = results.find(result => result.error)?.error;

  return (
    <Stack gap={8}>
      <Text type="secondary">{`显示时区：${display.resolvedOptions().timeZone}`}</Text>

      {intervals.map(interval => (
        <Flex key={interval.key} align="center" gap={8} wrap="wrap">
          <Text>{interval.label}</Text>

          {[
            ...new Set(holidays.filter(d => d.date >= interval.startsAt && d.date <= interval.endsAt)
              .map(d => d.name || "节假日"))
          ].map(name => <Tag key={name} color="orange">{name}</Tag>)}
        </Flex>
      ))}

      {dayError && <Text type="warning">{`节假日标注加载失败：${dayError.message}`}</Text>}
    </Stack>
  );
}

export function WindowPreview({
  rule,
  from,
  limit = 10
}: { rule: WindowRule; from?: number; limit?: number }) {
  const api = useCalendarApi();
  const issue = windowRuleIssue(rule);
  const ruleKey = JSON.stringify(rule);
  const [debouncedKey, setDebouncedKey] = useState(ruleKey);
  const debounced = useMemo(() => JSON.parse(debouncedKey) as WindowRule, [debouncedKey]);

  useEffect(() => {
    if (ruleKey === debouncedKey) {
      return;
    }

    const timer = setTimeout(() => setDebouncedKey(ruleKey), 350);

    return () => clearTimeout(timer);
  }, [ruleKey, debouncedKey]);

  const {
    data,
    error,
    isLoading,
    dataUpdatedAt
  } = useQuery({
    queryFn: api.previewWindows,
    queryKey: [
      api.previewWindows.key,
      {
        rule: debounced,
        from,
        limit
      }
    ],
    enabled: !issue && debouncedKey === ruleKey,
    retry: false
  });

  return (
    <Labeled label="开放时段预览">
      {issue
        ? <Text type="secondary">{`无法预览：${issue}`}</Text>
        : isLoading || debouncedKey !== ruleKey
          ? <Spin size="small" />
          : error
            ? <Alert showIcon title={error.message} type="error" />
            : data?.windows?.length
              ? <PreviewIntervals from={from ?? dataUpdatedAt} timezone={debounced.timezone || undefined} windows={data.windows} />
              : <Text type="secondary">近期没有开放时段</Text>}
    </Labeled>
  );
}
