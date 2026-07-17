import type { CrudBasicSceneFormValues, TableColumn } from "@vef-framework-react/components";
import type { EmptyObject } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { CompletedTask, MyTaskSearch, PendingTask } from "../../types";

import { css } from "@emotion/react";
import { Badge, Crud, Flex, FlexTabs, globalCssVars, OperationButton, Page, Tag, Text, Title } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { useState } from "react";

import { useMyApprovalApi } from "../../api";
import { formatTimestamp, InstanceDetailDrawer, TaskStatusTag, UserLabel } from "../../components";
import { FlowIcon } from "../../components/icon";

type TaskSceneValues = CrudBasicSceneFormValues<EmptyObject, EmptyObject>;

const rootCss = css({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingMd
});

function instanceTitleColumn<TRow extends { instanceTitle: string; instanceNo: string; flowIcon?: string }>(): TableColumn<TRow> {
  return {
    title: "审批单",
    dataIndex: "instanceTitle",
    render: (value: string, row) => (
      <Flex align="center" gap="small">
        <FlowIcon name={row.flowIcon} />

        <Flex vertical gap={2}>
          <Text>{value}</Text>
          <Text copyable style={{ fontSize: 12 }} type="secondary">{row.instanceNo}</Text>
        </Flex>
      </Flex>
    )
  };
}

const PENDING_COLUMNS: Array<TableColumn<PendingTask>> = [
  instanceTitleColumn<PendingTask>(),
  {
    title: "所属流程",
    dataIndex: "flowName",
    width: 160
  },
  {
    title: "申请人",
    dataIndex: "applicant",
    width: 160,
    render: (value: PendingTask["applicant"]) => <UserLabel user={value} />
  },
  {
    title: "当前节点",
    dataIndex: "nodeName",
    width: 140
  },
  {
    title: "到达时间",
    dataIndex: "createdAt",
    width: 160,
    render: (value: string) => formatTimestamp(value)
  },
  {
    title: "处理期限",
    dataIndex: "deadline",
    width: 170,
    render: (value: string | undefined, row) => (
      <Flex align="center" gap="small">
        <Text type={row.isTimeout ? "danger" : undefined}>{formatTimestamp(value)}</Text>
        {row.isTimeout && <Tag color="error">超时</Tag>}
      </Flex>
    )
  }
];

const COMPLETED_COLUMNS: Array<TableColumn<CompletedTask>> = [
  instanceTitleColumn<CompletedTask>(),
  {
    title: "所属流程",
    dataIndex: "flowName",
    width: 160
  },
  {
    title: "申请人",
    dataIndex: "applicant",
    width: 160,
    render: (value: CompletedTask["applicant"]) => <UserLabel user={value} />
  },
  {
    title: "处理节点",
    dataIndex: "nodeName",
    width: 140
  },
  {
    title: "处理结果",
    dataIndex: "status",
    width: 110,
    render: (value: string) => <TaskStatusTag status={value} />
  },
  {
    title: "处理时间",
    dataIndex: "finishedAt",
    width: 160,
    render: (value: string | undefined) => formatTimestamp(value)
  }
];

export interface ApprovalTaskCenterPageProps {
  /**
   * Scope the lists to one tenant; omit for the caller's full view.
   */
  tenantId?: string;
  /**
   * Optional page title rendered above each list.
   */
  title?: ReactNode;
}

/**
 * The task center: what awaits me and what I have handled. Opening a row
 * shows the full detail with the action bar; completing an action refreshes
 * both the list and the pending badge.
 */
export function ApprovalTaskCenterPage({ tenantId, title }: ApprovalTaskCenterPageProps) {
  const api = useMyApprovalApi();
  const [detailTarget, setDetailTarget] = useState<string | null>(null);

  const { data: counts, refetch: refetchCounts } = useQuery({
    queryFn: api.getPendingCounts,
    queryKey: [api.getPendingCounts.key, { tenantId }]
  });

  const [refreshToken, setRefreshToken] = useState(0);

  function handleActionCompleted(): void {
    setRefreshToken(token => token + 1);
    void refetchCounts();
  }

  const pendingList = (
    <Crud<PendingTask, MyTaskSearch, TaskSceneValues>
      key={`pending-${refreshToken}`}
      columnSettings={false}
      defaultSearchValues={{ tenantId }}
      queryFn={api.findPendingTasks}
      rowKey="taskId"
      tableColumns={PENDING_COLUMNS}
      operationColumn={{
        width: 90,
        render(row) {
          return (
            <OperationButton color="primary" onClick={() => setDetailTarget(row.instanceId)}>
              处理
            </OperationButton>
          );
        }
      }}
      onRowClick={row => setDetailTarget(row.instanceId)}
    />
  );

  const completedList = (
    <Crud<CompletedTask, MyTaskSearch, TaskSceneValues>
      key={`completed-${refreshToken}`}
      columnSettings={false}
      defaultSearchValues={{ tenantId }}
      queryFn={api.findCompletedTasks}
      rowKey="taskId"
      tableColumns={COMPLETED_COLUMNS}
      operationColumn={{
        width: 90,
        render(row) {
          return (
            <OperationButton onClick={() => setDetailTarget(row.instanceId)}>
              查看
            </OperationButton>
          );
        }
      }}
      onRowClick={row => setDetailTarget(row.instanceId)}
    />
  );

  return (
    <>
      <Page margin>
        <div css={rootCss}>
          {title ? <Title level={4}>{title}</Title> : null}

          <FlexTabs
            items={[
              {
                key: "pending",
                label: (
                  <Badge count={counts?.pendingTaskCount ?? 0} offset={[10, 0]} size="small">
                    待办
                  </Badge>
                ),
                children: pendingList
              },
              {
                key: "completed",
                label: "已办",
                children: completedList
              }
            ]}
          />
        </div>
      </Page>

      <InstanceDetailDrawer
        instanceId={detailTarget}
        onActionCompleted={handleActionCompleted}
        onClose={() => setDetailTarget(null)}
      />
    </>
  );
}
