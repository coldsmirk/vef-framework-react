import type { ReactElement } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Grid, Icon, Loader, Page } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { formatBytes, formatDuration } from "@vef-framework-react/shared";
import { GaugeIcon, InfoIcon } from "lucide-react";
import { getSystemOverview } from "~apis";

import { BuildInfoSection } from "./components/build-info-section";
import { NetworkTrafficCard } from "./components/network-traffic-card";
import { ProcessInfoCard } from "./components/process-info-card";
import { SystemInfoSection } from "./components/system-info-section";
import { SystemLoadCard } from "./components/system-load-card";
import { UsageChartCard } from "./components/usage-chart-card";
import classes from "./styles/index.module.scss";

export const Route = createFileRoute("/_layout/sys/monitor")({
  component: RouteComponent
});

const GRID_SPAN_CONFIG = {
  xs: 24,
  sm: 12,
  md: 12,
  lg: 8
} as const;

const REFETCH_INTERVAL = 5000;

function formatUptime(uptime: number | undefined): string | undefined {
  if (uptime === undefined) {
    return undefined;
  }

  return formatDuration(uptime);
}

function formatUsageExtra(used: number | undefined, total: number | undefined): string {
  return `${formatBytes(used ?? 0)} / ${formatBytes(total ?? 0)}`;
}

function RouteComponent(): ReactElement {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["system-overview"],
    queryFn: getSystemOverview,
    refetchInterval: REFETCH_INTERVAL
  });

  if (isLoading || !overview) {
    return (
      <Page>
        <Loader description="系统信息加载中, 请稍后..." size="large" />
      </Page>
    );
  }

  const {
    host,
    cpu,
    memory,
    disk,
    network,
    process,
    load,
    build
  } = overview;

  return (
    <Page scrollable scrollMargin>
      <div className={classes.pageWrapper}>
        {build && (
          <BuildInfoSection
            appVersion={build.appVersion}
            buildTime={build.buildTime}
            gitCommit={build.gitCommit}
            vefVersion={build.vefVersion}
          />
        )}

        <SystemInfoSection
          cpuCores={cpu?.logicalCores}
          hostname={host?.hostname}
          kernelArch={host?.kernelArch}
          platform={host?.platform}
          platformVersion={host?.platformVersion}
          uptime={formatUptime(host?.uptime)}
        />

        <h3 className={classes.sectionTitle}>
          <Icon component={GaugeIcon} />
          核心指标
        </h3>

        <Grid className={classes.row} gap="medium">
          <Grid.Item span={GRID_SPAN_CONFIG}>
            <UsageChartCard
              title="CPU使用率"
              usagePercent={Math.round(cpu?.usagePercent ?? 0)}
              extra={(
                <span className={classes.chartCardExtra}>
                  {/* usagePercent is normalized against the effective capacity
                      (cgroup quota inside a limited container), so the paired
                      core count must be effectiveCores, not host topology. */}
                  {cpu?.effectiveCores ?? 0}
                  {" 核"}
                </span>
              )}
            />
          </Grid.Item>

          <Grid.Item span={GRID_SPAN_CONFIG}>
            <UsageChartCard
              title="内存使用率"
              usagePercent={Math.round(memory?.usedPercent ?? 0)}
              extra={(
                <span className={classes.chartCardExtra}>
                  {formatUsageExtra(memory?.used, memory?.total)}
                </span>
              )}
            />
          </Grid.Item>

          <Grid.Item span={GRID_SPAN_CONFIG}>
            <UsageChartCard
              showWarning
              title="磁盘使用率"
              usagePercent={Math.round(disk?.usedPercent ?? 0)}
              extra={(
                <span className={classes.chartCardExtra}>
                  {formatUsageExtra(disk?.used, disk?.total)}
                </span>
              )}
            />
          </Grid.Item>
        </Grid>

        <h3 className={classes.sectionTitle}>
          <Icon component={InfoIcon} />
          详细信息
        </h3>

        <Grid gap="medium">
          <Grid.Item span={GRID_SPAN_CONFIG}>
            <SystemLoadCard
              cpuCores={cpu?.logicalCores ?? 0}
              load1={load?.load1}
              load5={load?.load5}
              load15={load?.load15}
            />
          </Grid.Item>

          <Grid.Item span={GRID_SPAN_CONFIG}>
            <NetworkTrafficCard
              bytesRecv={network?.bytesRecv}
              bytesSent={network?.bytesSent}
              interfaces={network?.interfaces}
              packetsRecv={network?.packetsRecv}
              packetsSent={network?.packetsSent}
            />
          </Grid.Item>

          <Grid.Item span={GRID_SPAN_CONFIG}>
            <ProcessInfoCard
              cpuPercent={process?.cpuPercent}
              memoryPercent={process?.memoryPercent}
              name={process?.name}
              pid={process?.pid}
              totalMemory={memory?.total}
            />
          </Grid.Item>
        </Grid>
      </div>
    </Page>
  );
}
