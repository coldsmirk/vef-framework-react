import type { TableColumn } from "@vef-framework-react/components";

import type { Schedule, TriggerKind } from "../../types";

import { Tag, Text } from "@vef-framework-react/components";

import { EnabledTag, formatTimestamp, formatTriggerSummary, TRIGGER_KIND_LABELS } from "../../components";

const KIND_TAG_COLORS: Record<TriggerKind, string> = {
  cron: "blue",
  interval: "geekblue",
  once: "purple"
};

export const scheduleColumns: Array<TableColumn<Schedule>> = [
  {
    title: "名称",
    dataIndex: "name",
    width: 180,
    render: (value: string) => <Text strong>{value}</Text>
  },
  {
    title: "任务处理器",
    dataIndex: "jobName",
    width: 160
  },
  {
    title: "触发方式",
    dataIndex: "kind",
    width: 110,
    align: "center",
    render: (value: TriggerKind) => <Tag color={KIND_TAG_COLORS[value]}>{TRIGGER_KIND_LABELS[value]}</Tag>
  },
  {
    // Computed from several trigger fields, so it renders off the row rather
    // than a single dataIndex.
    key: "trigger",
    title: "触发规则",
    minWidth: 220,
    render: (_: unknown, row: Schedule) => <Text>{formatTriggerSummary(row)}</Text>
  },
  {
    title: "状态",
    dataIndex: "isEnabled",
    width: 90,
    align: "center",
    render: (value: boolean) => <EnabledTag enabled={value} />
  },
  {
    title: "下次触发",
    dataIndex: "nextFireAt",
    width: 160,
    render: formatTimestamp
  },
  {
    title: "上次触发",
    dataIndex: "lastFireAt",
    width: 160,
    render: formatTimestamp
  }
];
