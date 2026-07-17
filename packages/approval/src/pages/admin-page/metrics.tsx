import type { BindingProjectionStatus, InstanceStatus, TaskStatus } from "../../types";

import { css } from "@emotion/react";
import { Button, Card, Empty, Flex, globalCssVars, Icon, ScrollArea, Spin, Stack, Statistic, Text } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { RotateCwIcon } from "lucide-react";

import { useAdminApprovalApi } from "../../api";
import { formatDurationSeconds, formatTimestamp } from "../../components";
import {
  BINDING_PROJECTION_STATUS_LABELS,
  INSTANCE_STATUS_LABELS,
  TASK_STATUS_LABELS
} from "../../components/status/labels";

const INSTANCE_ORDER: readonly InstanceStatus[] = ["running", "approved", "rejected", "returned", "withdrawn", "terminated"];
const TASK_ORDER: readonly TaskStatus[] = ["pending", "waiting", "approved", "rejected", "handled", "transferred"];

const scrollFillCss = css({
  height: "100%"
});

const statGridCss = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 16
});

const statGridWideCss = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 16
});

function isProjectionStatus(value: string): value is BindingProjectionStatus {
  return Object.hasOwn(BINDING_PROJECTION_STATUS_LABELS, value);
}

export interface MetricsPanelProps {
  tenantId?: string;
}

/**
 * The engine health dashboard: instance/task throughput by status, timeout
 * pressure, average end-to-end duration, and business write-back
 * convergence.
 */
export function MetricsPanel({ tenantId }: MetricsPanelProps) {
  const api = useAdminApprovalApi();

  const {
    data: metrics,
    isLoading,
    refetch,
    isFetching
  } = useQuery({
    queryFn: api.getMetrics,
    queryKey: [api.getMetrics.key, { tenantId }]
  });

  if (isLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 240 }}>
        <Spin />
      </Flex>
    );
  }

  if (!metrics) {
    return <Empty description="暂无指标数据" />;
  }

  const projectionEntries = Object.entries(metrics.businessProjectionCounts);

  return (
    <ScrollArea css={scrollFillCss} scrollbars="vertical">
      <Stack gap={16}>
        <Flex align="center" justify="space-between">
          <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
            {`采集时间 ${formatTimestamp(metrics.capturedAt)}`}
          </Text>

          <Button
            icon={<Icon component={RotateCwIcon} />}
            loading={isFetching}
            size="small"
            onClick={() => void refetch()}
          >
            刷新
          </Button>
        </Flex>

        <Card title="审批单">
          <div css={statGridCss}>
            {INSTANCE_ORDER.map(status => (
              <Statistic
                key={status}
                title={INSTANCE_STATUS_LABELS[status]}
                value={metrics.instanceCounts[status] ?? 0}
              />
            ))}
          </div>
        </Card>

        <Card title="任务">
          <div css={statGridCss}>
            {TASK_ORDER.map(status => (
              <Statistic
                key={status}
                title={TASK_STATUS_LABELS[status]}
                value={metrics.taskCounts[status] ?? 0}
              />
            ))}

            <Statistic
              styles={metrics.timeoutTaskCount > 0 ? { content: { color: globalCssVars.colorError } } : undefined}
              title="超时未处理"
              value={metrics.timeoutTaskCount}
            />
          </div>
        </Card>

        <Card title="效率与回写">
          <div css={statGridWideCss}>
            <Statistic
              title="平均办结时长"
              value={metrics.avgCompletionSeconds < 0 ? "-" : formatDurationSeconds(metrics.avgCompletionSeconds)}
            />

            <Statistic
              styles={metrics.pendingBindingFailures > 0 ? { content: { color: globalCssVars.colorWarning } } : undefined}
              title="待重试回写"
              value={metrics.pendingBindingFailures}
            />

            <Statistic title="未收敛投影" value={metrics.pendingBusinessProjections} />

            {projectionEntries.map(([status, count]) => (
              <Statistic
                key={status}
                title={isProjectionStatus(status) ? BINDING_PROJECTION_STATUS_LABELS[status] : status}
                value={count ?? 0}
              />
            ))}
          </div>
        </Card>
      </Stack>
    </ScrollArea>
  );
}
