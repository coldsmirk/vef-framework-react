import type { ReactElement } from "react";

import { Card, Descriptions, Tag } from "@vef-framework-react/components";
import { formatBytes } from "@vef-framework-react/shared";
import { memo } from "react";

import classes from "../styles/index.module.scss";

type StatusColor = "success" | "warning" | "error";

interface ProcessInfoCardProps {
  name?: string;
  pid?: number;
  cpuPercent?: number;
  memoryPercent?: number;
  totalMemory?: number;
}

function getStatusColor(percent: number): StatusColor {
  if (percent < 70) {
    return "success";
  }

  if (percent < 90) {
    return "warning";
  }

  return "error";
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) {
    return "0";
  }

  return value.toFixed(2);
}

function calculateMemoryUsage(totalMemory: number, memoryPercent: number): number {
  return totalMemory * memoryPercent / 100;
}

function ProcessInfoCardComponent({
  name,
  pid,
  cpuPercent = 0,
  memoryPercent = 0,
  totalMemory = 0
}: ProcessInfoCardProps): ReactElement {
  const memoryUsage = calculateMemoryUsage(totalMemory, memoryPercent);

  return (
    <Card className={classes.card} title="应用进程">
      <Descriptions className={classes.justifiedDescriptions} column={1} size="small">
        <Descriptions.Item label="进程名称">
          {name || "-"}
        </Descriptions.Item>

        <Descriptions.Item label="进程编号">
          {pid || "-"}
        </Descriptions.Item>

        <Descriptions.Item label="CPU占用率">
          <Tag color={getStatusColor(cpuPercent)} variant="filled">
            {formatPercent(cpuPercent)}
            %
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item label="内存占用率">
          <Tag color={getStatusColor(memoryPercent)} variant="filled">
            {formatPercent(memoryPercent)}
            %
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item label="内存占用量">
          {formatBytes(memoryUsage)}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

export const ProcessInfoCard = memo(ProcessInfoCardComponent);
ProcessInfoCard.displayName = "ProcessInfoCard";
