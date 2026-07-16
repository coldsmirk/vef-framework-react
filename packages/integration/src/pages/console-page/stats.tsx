import type { TableColumn } from "@vef-framework-react/components";

import type { Direction, FailureKind, InvocationStats } from "../../types";

import { Button, Flex, Stack, Table, Tag, Text } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";

import { useStatsApi } from "../../api";
import { DirectionTag, FAILURE_KIND_COLORS, FAILURE_KIND_LABELS } from "../../components";
import { FAILURE_KINDS } from "../../types";

function renderFailures(failures: Partial<Record<FailureKind, number>> | undefined) {
  if (!failures) {
    return <Text type="secondary">-</Text>;
  }

  const active = FAILURE_KINDS.filter(kind => failures[kind]);

  if (active.length === 0) {
    return <Text type="secondary">-</Text>;
  }

  return (
    <Flex gap={4} wrap="wrap">
      {active.map(kind => (
        <Tag key={kind} color={FAILURE_KIND_COLORS[kind]}>
          {FAILURE_KIND_LABELS[kind]}
          :
          {failures[kind]}
        </Tag>
      ))}
    </Flex>
  );
}

function renderLastError(value: string | undefined) {
  return value ? <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 220 }} type="danger">{value}</Text> : <Text type="secondary">-</Text>;
}

const statsColumns: Array<TableColumn<InvocationStats>> = [
  {
    title: "系统",
    dataIndex: "system",
    width: 140
  },
  {
    title: "契约",
    dataIndex: "contract",
    width: 140
  },
  {
    title: "方向",
    dataIndex: "direction",
    width: 80,
    align: "center",
    render: (value: Direction) => <DirectionTag direction={value} />
  },
  {
    title: "调用",
    dataIndex: "calls",
    width: 80,
    align: "right"
  },
  {
    title: "成功",
    dataIndex: "successes",
    width: 80,
    align: "right"
  },
  {
    title: "失败分布",
    dataIndex: "failures",
    render: renderFailures
  },
  {
    title: "平均(ms)",
    dataIndex: "avgDurationMs",
    width: 90,
    align: "right"
  },
  {
    title: "最大(ms)",
    dataIndex: "maxDurationMs",
    width: 90,
    align: "right"
  },
  {
    title: "最近错误",
    dataIndex: "lastError",
    render: renderLastError
  }
];

/**
 * The per-node integration invocation statistics table.
 */
export function StatsPanel() {
  const { getStats } = useStatsApi();
  const {
    data,
    isLoading,
    refetch
  } = useQuery({ queryFn: getStats, queryKey: [getStats.key] });
  const stats = data?.stats ?? [];

  return (
    <Stack gap="middle">
      <Flex align="center" justify="space-between">
        <Text type="secondary">本节点自进程启动以来的运行时快照</Text>

        <Button loading={isLoading} size="small" onClick={() => void refetch()}>
          刷新
        </Button>
      </Flex>

      <Table<InvocationStats>
        columns={statsColumns}
        dataSource={stats}
        pagination={false}
        rowKey={record => `${record.system}|${record.contract}|${record.direction}`}
        size="small"
      />
    </Stack>
  );
}
