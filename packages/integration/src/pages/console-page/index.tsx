import type { TabItem } from "@vef-framework-react/components";
import type { ReactNode } from "react";

import { Page, Result, Stack, Tabs, Title } from "@vef-framework-react/components";
import { checkPermission, useAppContext } from "@vef-framework-react/core";

import { INTEGRATION_PERMISSIONS } from "../../permissions";
import { DiagnosticsPanel } from "./diagnostics";
import { DryRunPanel } from "./dry-run";
import { LogPanel } from "./log";
import { StatsPanel } from "./stats";

export interface IntegrationConsolePageProps {
  /**
   * Override the permission codes gating each console tab.
   */
  permissions?: {
    dryRun?: string;
    dryRunInbound?: string;
    diagnoseRoutes?: string;
    logQuery?: string;
    statsView?: string;
  };
  /**
   * Optional page title.
   */
  title?: ReactNode;
}

/**
 * The integration engine operations console: dry-run, diagnostics, logs, and stats.
 */
export function IntegrationConsolePage({ permissions, title }: IntegrationConsolePageProps) {
  const perms = {
    dryRun: permissions?.dryRun ?? INTEGRATION_PERMISSIONS.ops.dryRun,
    dryRunInbound: permissions?.dryRunInbound ?? INTEGRATION_PERMISSIONS.ops.dryRunInbound,
    diagnoseRoutes: permissions?.diagnoseRoutes ?? INTEGRATION_PERMISSIONS.ops.diagnoseRoutes,
    logQuery: permissions?.logQuery ?? INTEGRATION_PERMISSIONS.log.query,
    statsView: permissions?.statsView ?? INTEGRATION_PERMISSIONS.log.query
  };

  const { hasPermission = () => true } = useAppContext();
  const canDryRunOutbound = checkPermission(hasPermission, perms.dryRun);
  const canDryRunInbound = checkPermission(hasPermission, perms.dryRunInbound);
  const canDiagnose = checkPermission(hasPermission, perms.diagnoseRoutes);
  const canLog = checkPermission(hasPermission, perms.logQuery);
  const canStats = checkPermission(hasPermission, perms.statsView);

  const items: TabItem[] = [];

  if (canDryRunOutbound || canDryRunInbound) {
    items.push({
      key: "dry-run",
      label: "脚本调试台",
      children: <DryRunPanel inboundPermission={perms.dryRunInbound} outboundPermission={perms.dryRun} />
    });
  }

  if (canDiagnose) {
    items.push({
      key: "diagnostics",
      label: "路由诊断",
      children: <DiagnosticsPanel permission={perms.diagnoseRoutes} />
    });
  }

  if (canLog) {
    items.push({
      key: "log",
      label: "调用日志",
      children: <LogPanel />
    });
  }

  if (canStats) {
    items.push({
      key: "stats",
      label: "运行统计",
      children: <StatsPanel />
    });
  }

  return (
    <Page>
      <Stack gap="middle">
        {title ? <Title level={4}>{title}</Title> : null}

        {items.length > 0
          ? <Tabs defaultActiveKey={items[0]?.key} items={items} />
          : <Result status="403" subTitle="你没有集成引擎控制台的任何操作权限。" title="无访问权限" />}
      </Stack>
    </Page>
  );
}
