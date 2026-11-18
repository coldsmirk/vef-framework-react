import type { Day, DayKind } from "../types";

import { css } from "@emotion/react";
import { Alert, Button, DatePicker, Flex, globalCssVars, Segmented, Spin, Stack, Text } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import { useCalendarApi } from "../api";
import { DAY_KINDS, WEEKDAYS } from "./format-window-rule";

const tones: Record<DayKind, string> = {
  workday: globalCssVars.colorText,
  rest_day: globalCssVars.colorTextSecondary,
  holiday: globalCssVars.colorErrorText
};

const monthGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 2
});
const cellCss = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 2,
  minWidth: 0,
  font: "inherit",
  border: "1px solid transparent",
  borderRadius: globalCssVars.borderRadiusSm,
  "button&": { cursor: "pointer" },
  "&[aria-pressed=true]": { borderColor: globalCssVars.colorPrimary, background: globalCssVars.colorPrimaryBg },
  "&:focus-visible": { outline: `2px solid ${globalCssVars.colorPrimary}` }
});

interface Selection {
  dates: ReadonlySet<string>;
  onChange: (dates: Set<string>) => void;
}

function between(date: string, from: string, to: string) {
  return (date >= from && date <= to) || (date >= to && date <= from);
}

export function CalendarView({ selection }: { selection?: Selection }) {
  const api = useCalendarApi();
  const [anchor, setAnchor] = useState(() => dayjs().startOf("month"));
  const [view, setView] = useState<"year" | "month">("month");
  const [drag, setDrag] = useState<{ from: string; to: string }>();

  const startsAt = anchor.startOf(view).format("YYYY-MM-DD");
  const endsAt = anchor.endOf(view).format("YYYY-MM-DD");
  const {
    data,
    error,
    isLoading
  } = useQuery({
    queryFn: api.findCalendarDays,
    queryKey: [api.findCalendarDays.key, { startsAt, endsAt }]
  });
  const months = Map.groupBy(data ?? [], day => day.date.slice(0, 7));
  const compact = view === "year";

  useEffect(() => {
    if (!drag || !selection) {
      return;
    }

    const events = new AbortController();
    addEventListener("mouseup", event => {
      if (event.button !== 0) {
        return;
      }

      if (drag.from !== drag.to) {
        const range = (data ?? []).filter(day => between(day.date, drag.from, drag.to));
        selection.onChange(new Set([...selection.dates, ...range.map(day => day.date)]));
      }

      setDrag(undefined);
    }, { capture: true, signal: events.signal });
    window.addEventListener("blur", () => setDrag(undefined), { signal: events.signal });

    return () => events.abort();
  }, [drag, selection, data]);

  function toggleDate(date: string) {
    if (!selection) {
      return;
    }

    const next = new Set(selection.dates);

    if (next.has(date)) {
      next.delete(date);
    } else {
      next.add(date);
    }

    selection.onChange(next);
  }

  function renderDay(day: Day, first: boolean) {
    const dateNumber = Number(day.date.slice(-2));
    const content = (
      <>
        <span>{dateNumber}</span>
        {(!compact || day.name) && <small style={{ overflowWrap: "anywhere" }}>{day.name || DAY_KINDS[day.kind]}</small>}
      </>
    );
    const inDrag = drag && drag.from !== drag.to && between(day.date, drag.from, drag.to);
    const style = {
      gridColumnStart: first ? ((dayjs(day.date).day() + 6) % 7) + 1 : undefined,
      minHeight: compact ? 26 : 62,
      background: inDrag
        ? globalCssVars.colorPrimaryBg
        : day.kind === "holiday"
          ? globalCssVars.colorErrorBg
          : day.kind === "rest_day" ? globalCssVars.colorFillQuaternary : "transparent",
      color: tones[day.kind]
    };
    const label = [day.date, DAY_KINDS[day.kind], day.name].filter(Boolean).join(" ");

    if (!selection) {
      return <div key={day.date} aria-label={label} css={cellCss} style={style}>{content}</div>;
    }

    return (
      <button
        key={day.date}
        aria-label={label}
        aria-pressed={selection.dates.has(day.date)}
        css={cellCss}
        style={{ ...style, background: selection.dates.has(day.date) ? globalCssVars.colorPrimaryBg : style.background }}
        type="button"
        onClick={() => toggleDate(day.date)}
        onMouseDown={event => {
          if (event.button === 0) {
            setDrag({ from: day.date, to: day.date });
          }
        }}
        onMouseEnter={event => {
          if (drag && event.buttons === 1) {
            setDrag({ ...drag, to: day.date });
          }
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <Stack gap={16}>
      <Flex align="center" gap="small" justify="space-between" wrap="wrap">
        <Flex align="center" gap={4}>
          <Button aria-label={compact ? "上一年" : "上个月"} onClick={() => setAnchor(anchor.subtract(1, view))}>‹</Button>

          <DatePicker
            allowClear={false}
            aria-label={compact ? "年份" : "月份"}
            format={compact ? "YYYY 年" : "YYYY 年 M 月"}
            picker={view}
            value={anchor}
            onChange={next => {
              if (next) {
                setAnchor(next.startOf("month"));
              }
            }}
          />

          <Button aria-label={compact ? "下一年" : "下个月"} onClick={() => setAnchor(anchor.add(1, view))}>›</Button>
        </Flex>

        <Segmented<"month" | "year">
          options={[{ label: "月视图", value: "month" }, { label: "年视图", value: "year" }]}
          value={view}
          onChange={setView}
        />
      </Flex>

      {isLoading
        ? <Spin />
        : error
          ? <Alert showIcon title={error.message} type="error" />
          : (
              <div css={{
                display: "grid",
                gap: 20,
                gridTemplateColumns: compact ? "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" : "1fr"
              }}
              >
                {[...months].map(([month, days]) => (
                  <Stack key={month} gap={8}>
                    {compact && <Text strong>{`${Number(month.slice(-2))} 月`}</Text>}

                    <div css={monthGrid} style={{ textAlign: "center", userSelect: selection ? "none" : undefined }}>
                      {WEEKDAYS.map(weekday => <small key={weekday} style={{ color: globalCssVars.colorTextSecondary }}>{weekday}</small>)}
                      {days.map((day, i) => renderDay(day, i === 0))}
                    </div>
                  </Stack>
                ))}
              </div>
            )}
    </Stack>
  );
}

export function WorkCalendar() {
  return <CalendarView />;
}
