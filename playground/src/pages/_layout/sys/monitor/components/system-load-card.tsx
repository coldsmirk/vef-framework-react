import type { ReactElement } from "react";

import { Card, Progress } from "@vef-framework-react/components";
import { memo } from "react";

import classes from "../styles/index.module.scss";

interface SystemLoadCardProps {
  load1?: number;
  load5?: number;
  load15?: number;
  cpuCores: number;
}

interface LoadItemProps {
  label: string;
  load: number | undefined;
  cpuCores: number;
}

function calculateLoadPercent(load: number, cores: number): number {
  if (cores === 0) {
    return 0;
  }

  const percent = (load / cores) * 100;
  return Math.min(Math.round(percent), 100);
}

function getLoadProgressColor(percent: number): string {
  if (percent < 70) {
    return "var(--vef-color-success)";
  }

  if (percent < 90) {
    return "var(--vef-color-warning)";
  }

  return "var(--vef-color-error)";
}

function formatLoadValue(load: number | undefined): string {
  if (load === undefined) {
    return "-";
  }

  return load.toFixed(2);
}

function LoadItem({
  label,
  load,
  cpuCores
}: LoadItemProps): ReactElement {
  const loadValue = load ?? 0;
  const percent = calculateLoadPercent(loadValue, cpuCores);
  const strokeColor = getLoadProgressColor(percent);

  return (
    <div className={classes.loadItem}>
      <div className={classes.loadHeader}>
        <span className={classes.loadLabel}>{label}</span>

        <span className={classes.loadValue}>
          {formatLoadValue(load)}
          {" / "}
          {cpuCores}
          核
        </span>
      </div>

      <Progress
        showInfo
        percent={percent}
        strokeColor={strokeColor}
      />
    </div>
  );
}

function SystemLoadCardComponent({
  load1,
  load5,
  load15,
  cpuCores
}: SystemLoadCardProps): ReactElement {
  return (
    <Card className={classes.card} title="系统负载">
      <div className={classes.loadContainer}>
        <LoadItem cpuCores={cpuCores} label="1分钟负载" load={load1} />
        <LoadItem cpuCores={cpuCores} label="5分钟负载" load={load5} />
        <LoadItem cpuCores={cpuCores} label="15分钟负载" load={load15} />
      </div>
    </Card>
  );
}

export const SystemLoadCard = memo(SystemLoadCardComponent);
SystemLoadCard.displayName = "SystemLoadCard";
