import type { TabItem } from "@vef-framework-react/components";
import type { ReactNode } from "react";

import { css } from "@emotion/react";
import { FlexTabs, globalCssVars, Page, Result, Title } from "@vef-framework-react/components";
import { checkPermission, useAppContext } from "@vef-framework-react/core";

import { APPROVAL_PERMISSIONS } from "../../permissions";
import { InstancesPanel } from "./instances";
import { MetricsPanel } from "./metrics";
import { ProjectionsPanel } from "./projections";
import { TasksPanel } from "./tasks";

const rootCss = css({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingMd
});

export interface ApprovalAdminPageProps {
  /**
   * Override the permission codes gating each console tab.
   */
  permissions?: {
    instanceQuery?: string;
    instanceDetail?: string;
    instanceTerminate?: string;
    taskQuery?: string;
    taskReassign?: string;
    bindingQuery?: string;
    bindingRetry?: string;
    metricsQuery?: string;
  };
  /**
   * Scope the metrics view to one tenant; omit for the caller's default
   * scope.
   */
  tenantId?: string;
  /**
   * Optional page title.
   */
  title?: ReactNode;
}

/**
 * The approval supervision console: cross-user instances and tasks, business
 * write-back convergence, and engine metrics — each tab gated by its own
 * permission and hidden when the caller lacks it.
 */
export function ApprovalAdminPage({
  permissions,
  tenantId,
  title
}: ApprovalAdminPageProps) {
  const perms = {
    instanceQuery: permissions?.instanceQuery ?? APPROVAL_PERMISSIONS.instance.query,
    instanceDetail: permissions?.instanceDetail ?? APPROVAL_PERMISSIONS.instance.detail,
    instanceTerminate: permissions?.instanceTerminate ?? APPROVAL_PERMISSIONS.instance.terminate,
    taskQuery: permissions?.taskQuery ?? APPROVAL_PERMISSIONS.task.query,
    taskReassign: permissions?.taskReassign ?? APPROVAL_PERMISSIONS.task.reassign,
    bindingQuery: permissions?.bindingQuery ?? APPROVAL_PERMISSIONS.binding.query,
    bindingRetry: permissions?.bindingRetry ?? APPROVAL_PERMISSIONS.binding.retry,
    metricsQuery: permissions?.metricsQuery ?? APPROVAL_PERMISSIONS.metrics.query
  };

  const { hasPermission = () => true } = useAppContext();

  const items: TabItem[] = [];

  if (checkPermission(hasPermission, perms.instanceQuery)) {
    items.push({
      key: "instances",
      label: "实例管理",
      children: <InstancesPanel detailPermission={perms.instanceDetail} terminatePermission={perms.instanceTerminate} />
    });
  }

  if (checkPermission(hasPermission, perms.taskQuery)) {
    items.push({
      key: "tasks",
      label: "任务管理",
      children: <TasksPanel reassignPermission={perms.taskReassign} />
    });
  }

  if (checkPermission(hasPermission, perms.bindingQuery)) {
    items.push({
      key: "projections",
      label: "业务回写",
      children: <ProjectionsPanel retryPermission={perms.bindingRetry} />
    });
  }

  if (checkPermission(hasPermission, perms.metricsQuery)) {
    items.push({
      key: "metrics",
      label: "运行指标",
      children: <MetricsPanel tenantId={tenantId} />
    });
  }

  return (
    <Page margin>
      <div css={rootCss}>
        {title ? <Title level={4}>{title}</Title> : null}

        {items.length > 0
          ? <FlexTabs defaultActiveKey={items[0]?.key} items={items} />
          : <Result status="403" subTitle="你没有审批管理台的任何操作权限。" title="无访问权限" />}
      </div>
    </Page>
  );
}
