import type { TableColumn } from "@vef-framework-react/components";

import type { Direction, FailureKind, InvocationStats } from "../../types";

import { css } from "@emotion/react";
import { Button, Flex, FlexCard, globalCssVars, Icon, Table, Tag, Text } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { RotateCwIcon } from "lucide-react";

import { useStatsApi } from "../../api";
import { DirectionTag, FAILURE_KIND_COLORS, FAILURE_KIND_LABELS } from "../../components";
import { FAILURE_KINDS } from "../../types";

const panelCss = css({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingMd
});

// The framework Table scrolls its own body inside a height-bounded box, the
// same way the CRUD list pages do.
const tableAreaCss = css({
  flex: 1,
  minHeight: 0
});

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
    <FlexCard>
      <div css={panelCss}>
        <Flex align="center" gap="middle" justify="space-between" wrap="wrap">
          <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
            本节点自进程启动以来的运行时快照，按系统 × 契约 × 方向汇总。
          </Text>

          <Button icon={<Icon component={RotateCwIcon} />} loading={isLoading} onClick={() => void refetch()}>
            刷新
          </Button>
        </Flex>

        <div css={tableAreaCss}>
          <Table<InvocationStats>
            columns={statsColumns}
            dataSource={stats}
            locale={{ emptyText: "暂无调用记录" }}
            pagination={false}
            rowKey={record => `${record.system}|${record.contract}|${record.direction}`}
            size="small"
          />
        </div>
      </div>
    </FlexCard>
  );
}
