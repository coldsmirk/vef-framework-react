import type { TableColumn } from "@vef-framework-react/components";

import type { Run, RunStatus } from "../../types";

import { Text } from "@vef-framework-react/components";

import { formatDuration, formatTimestamp, RunStatusBadge } from "../../components";

export const runColumns: Array<TableColumn<Run>> = [
  {
    title: "调度名称",
    dataIndex: "scheduleName",
    width: 180,
    render: (value: string) => <Text strong>{value}</Text>
  },
  {
    title: "任务处理器",
    dataIndex: "jobName",
    width: 150
  },
  {
    title: "状态",
    dataIndex: "status",
    width: 100,
    align: "center",
    render: (value: RunStatus) => <RunStatusBadge status={value} />
  },
  {
    title: "计划时间",
    dataIndex: "scheduledAt",
    width: 160,
    render: formatTimestamp
  },
  {
    title: "开始时间",
    dataIndex: "startedAt",
    width: 160,
    render: formatTimestamp
  },
  {
    title: "结束时间",
    dataIndex: "finishedAt",
    width: 160,
    render: formatTimestamp
  },
  {
    title: "耗时",
    dataIndex: "durationMs",
    width: 100,
    align: "right",
    render: (value: number) => formatDuration(value)
  },
  {
    title: "节点",
    dataIndex: "nodeId",
    minWidth: 140
  },
  {
    // Only meaningful for a missed occurrence (how many fires the gap covered).
    title: "错过次数",
    dataIndex: "missedCount",
    width: 90,
    align: "center",
    render: (value: number | undefined, row: Run) => row.status === "missed" ? String(value ?? 0) : "-"
  }
];
