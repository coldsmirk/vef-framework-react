import type { DescriptionsItem } from "@vef-framework-react/components";

import type { Run } from "../../types";

import { css } from "@emotion/react";
import { Center, Descriptions, Drawer, globalCssVars, Labeled, Spin, Stack } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";

import { useRunApi } from "../../api";
import { formatDuration, formatTimestamp, RunStatusBadge } from "../../components";

const errorBoxCss = css({
  maxHeight: 280,
  overflow: "auto",
  padding: globalCssVars.spacingSm,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorErrorBg,
  color: globalCssVars.colorText,
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: globalCssVars.fontSizeSm,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word"
});

function detailItems(run: Run): DescriptionsItem[] {
  const items: DescriptionsItem[] = [
    {
      key: "scheduleName",
      label: "调度名称",
      children: run.scheduleName
    },
    {
      key: "jobName",
      label: "任务处理器",
      children: run.jobName
    },
    {
      key: "status",
      label: "状态",
      children: <RunStatusBadge status={run.status} />
    },
    {
      key: "nodeId",
      label: "节点",
      children: run.nodeId || "-"
    },
    {
      key: "scheduledAt",
      label: "计划时间",
      children: formatTimestamp(run.scheduledAt)
    },
    {
      key: "startedAt",
      label: "开始时间",
      children: formatTimestamp(run.startedAt)
    },
    {
      key: "finishedAt",
      label: "结束时间",
      children: formatTimestamp(run.finishedAt)
    },
    {
      key: "durationMs",
      label: "耗时",
      children: formatDuration(run.durationMs)
    },
    {
      key: "heartbeatAt",
      label: "心跳时间",
      children: formatTimestamp(run.heartbeatAt)
    },
    {
      key: "createdAt",
      label: "创建时间",
      children: formatTimestamp(run.createdAt)
    }
  ];

  if (run.status === "missed") {
    items.push({
      key: "missedCount",
      label: "错过次数",
      children: String(run.missedCount ?? 0)
    });
  }

  return items;
}

function RunDetail({ run }: { run: Run }) {
  return (
    <Stack gap="middle">
      <Descriptions bordered column={2} items={detailItems(run)} size="small" styles={{ label: { width: 96 } }} />

      {run.error
        ? (
            <Labeled label="错误信息">
              <div css={errorBoxCss}>{run.error}</div>
            </Labeled>
          )
        : null}
    </Stack>
  );
}

export interface RunDetailDrawerProps {
  runId: string | null;
  onClose: () => void;
}

/**
 * The run detail drawer. It refetches the full row through `find_one` so the
 * complete, untruncated error text is always available.
 */
export function RunDetailDrawer({ runId, onClose }: RunDetailDrawerProps) {
  const api = useRunApi();
  const { data, isFetching } = useQuery({
    enabled: runId !== null,
    queryFn: api.findOne,
    queryKey: [api.findOne.key, { id: runId ?? "" }]
  });

  return (
    <Drawer open={runId !== null} size={640} title="运行详情" onClose={onClose}>
      {isFetching && !data
        ? <Center style={{ height: 160 }}><Spin /></Center>
        : data
          ? <RunDetail run={data} />
          : null}
    </Drawer>
  );
}
