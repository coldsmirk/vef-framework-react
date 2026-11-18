import type { DayKind, TimeRange, Window } from "../types";

import { Button, DatePicker, Flex, globalCssVars, Labeled, Select, Stack, Text, TimePicker } from "@vef-framework-react/components";
import dayjs from "dayjs";

import { DAY_KINDS, WEEKDAYS } from "./format-window-rule";

function sequence(count: number) {
  return Array.from({ length: count }, (_, index) => index + 1);
}

const MONTHS = sequence(12).map(value => {
  return { label: `${value} 月`, value };
});
const DAYS = [
  ...sequence(31).map(value => {
    return { label: String(value), value };
  }),
  { label: "最后一天", value: -1 }
];
const BACKWARDS = sequence(30).map(n => {
  return { label: `倒数第 ${n + 1} 天`, value: -n - 1 };
});
const WEEK = WEEKDAYS.map((label, index) => {
  return { label, value: index + 1 };
});
const KINDS = (Object.keys(DAY_KINDS) as DayKind[]).map(value => {
  return { label: DAY_KINDS[value], value };
});
const ORDINALS = [...sequence(23), ...sequence(23).map(n => -n)].map(value => {
  return {
    label: value === -1 ? "最后一个工作日" : `${value < 0 ? "倒数" : ""}第 ${Math.abs(value)} 个工作日`,
    value
  };
});

const EMPTY_VALUES: never[] = [];

function Choices<T extends number | string>({
  options,
  columns,
  wideOption,
  value = EMPTY_VALUES,
  onChange
}: {
  options: Array<{ value: T; label: string }>;
  columns?: number;
  wideOption?: T;
  value?: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <div css={{
      display: columns ? "grid" : "flex",
      flexWrap: "wrap",
      gap: 4,
      gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : undefined
    }}
    >
      {options.map(item => {
        const selected = value.includes(item.value);

        return (
          <Button
            key={item.value}
            aria-pressed={selected}
            autoInsertSpace={false}
            size="small"
            style={{ minWidth: 36, gridColumn: item.value === wideOption ? "span 2" : undefined }}
            type={selected ? "primary" : "default"}
            onClick={() => onChange(selected ? value.filter(v => v !== item.value) : [...value, item.value])}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}

function TimesEditor({ values = EMPTY_VALUES, onChange }: { values?: TimeRange[]; onChange: (next: TimeRange[]) => void }) {
  function changeTime(index: number, key: keyof TimeRange, value: string) {
    onChange(values.map((range, i) => i === index ? { ...range, [key]: value } : range));
  }

  return (
    <Stack gap={8}>
      {values.map((range, i) => (
        <Flex key={i} align="center" gap={8} wrap="wrap">
          <TimePicker
            allowClear={false}
            aria-label="开始时间"
            format="HH:mm:ss"
            needConfirm={false}
            value={dayjs(`2000-01-01T${range.startsAt}`)}
            onChange={next => {
              if (next) {
                changeTime(i, "startsAt", next.format("HH:mm:ss"));
              }
            }}
          />

          <span>至</span>

          <TimePicker
            allowClear={false}
            aria-label="结束时间"
            format="HH:mm:ss"
            needConfirm={false}
            value={dayjs(`2000-01-01T${range.endsAt}`)}
            onChange={next => {
              if (next) {
                changeTime(i, "endsAt", next.format("HH:mm:ss"));
              }
            }}
          />

          {range.endsAt < range.startsAt && <span style={{ color: globalCssVars.colorTextSecondary }}>次日结束</span>}
          {range.startsAt === range.endsAt && <Text role="alert" type="danger">开始与结束时间不能相同</Text>}
          <Button size="small" type="text" onClick={() => onChange(values.filter((_, index) => index !== i))}>移除时段</Button>
        </Flex>
      ))}

      <Button style={{ alignSelf: "flex-start" }} onClick={() => onChange([...values, { startsAt: "09:00:00", endsAt: "17:00:00" }])}>
        添加时段
      </Button>
    </Stack>
  );
}

export function WindowFields({ value, onChange }: { value: Window; onChange: (next: Window) => void }) {
  function update<K extends keyof Window>(key: K, next: Window[K]) {
    const updated = { ...value, [key]: next };

    if (next === undefined || (Array.isArray(next) && next.length === 0)) {
      delete updated[key];
    }

    onChange(updated);
  }

  return (
    <Stack gap={14}>
      <Labeled label="月份"><Choices options={MONTHS} value={value.months} onChange={v => update("months", v)} /></Labeled>

      <Labeled label="月日">
        <Stack gap={8} style={{ width: "100%", maxWidth: 384 }}>
          <Choices columns={7} options={DAYS} value={value.monthDays} wideOption={-1} onChange={v => update("monthDays", v)} />

          <Select<number[]>
            aria-label="其他倒数日期"
            mode="multiple"
            options={BACKWARDS}
            placeholder="其他倒数日期"
            showSearch={{ optionFilterProp: "label" }}
            value={value.monthDays?.filter(n => n < -1) ?? []}
            onChange={v => update("monthDays", [...value.monthDays?.filter(n => n >= -1) ?? [], ...v])}
          />
        </Stack>
      </Labeled>

      <Labeled label="星期"><Choices options={WEEK} value={value.weekdays} onChange={v => update("weekdays", v)} /></Labeled>
      <Labeled label="日期类型"><Choices options={KINDS} value={value.dayKinds} onChange={v => update("dayKinds", v)} /></Labeled>

      <Labeled label="每月第几个工作日">
        <Select<number[]>
          aria-label="每月第几个工作日"
          mode="multiple"
          options={ORDINALS}
          placeholder="不限"
          showSearch={{ optionFilterProp: "label" }}
          value={value.workdayOrdinals ?? []}
          onChange={v => update("workdayOrdinals", v)}
        />
      </Labeled>

      <Labeled hint="不添加时段表示全天。" label="每日时段">
        <TimesEditor values={value.times} onChange={v => update("times", v)} />
      </Labeled>

      <Labeled label="日期区间">
        <DatePicker.RangePicker
          format="YYYY-MM-DD"
          placeholder={["开始日期", "结束日期"]}
          value={value.dates ? [dayjs(value.dates.startsAt), dayjs(value.dates.endsAt)] : null}
          onChange={(dates, [startsAt, endsAt]) => update("dates", dates ? { startsAt, endsAt } : undefined)}
        />
      </Labeled>
    </Stack>
  );
}
