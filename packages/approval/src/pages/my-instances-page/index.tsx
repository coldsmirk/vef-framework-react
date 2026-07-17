import type { CrudBasicSceneFormValues, TableColumn } from "@vef-framework-react/components";
import type { EmptyObject } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { InitiatedInstance, InitiatedInstanceSearch, MyCCRecord, MyCCRecordSearch } from "../../types";

import { css } from "@emotion/react";
import { Badge, Crud, Flex, FlexTabs, globalCssVars, OperationButton, Page, Tag, Text, Title, useFormContext } from "@vef-framework-react/components";
import { useMutation, useQuery } from "@vef-framework-react/core";
import { useState } from "react";

import { useInstanceApi, useMyApprovalApi } from "../../api";
import { formatTimestamp, InstanceDetailDrawer, InstanceStatusTag, UserLabel } from "../../components";
import { FlowIcon } from "../../components/icon";
import { INSTANCE_STATUS_OPTIONS } from "../../components/status/labels";

type SceneValues = CrudBasicSceneFormValues<EmptyObject, EmptyObject>;

const rootCss = css({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingMd
});

const INITIATED_COLUMNS: Array<TableColumn<InitiatedInstance>> = [
  {
    title: "审批单",
    dataIndex: "title",
    render: (value: string, row) => (
      <Flex align="center" gap="small">
        <FlowIcon name={row.flowIcon} />

        <Flex vertical gap={2}>
          <Text>{value}</Text>
          <Text copyable style={{ fontSize: 12 }} type="secondary">{row.instanceNo}</Text>
        </Flex>
      </Flex>
    )
  },
  {
    title: "所属流程",
    dataIndex: "flowName",
    width: 160
  },
  {
    title: "状态",
    dataIndex: "status",
    width: 100,
    render: (value: InitiatedInstance["status"]) => <InstanceStatusTag status={value} />
  },
  {
    title: "当前节点",
    dataIndex: "currentNodeName",
    width: 140,
    render: (value: string | undefined) => value ?? "-"
  },
  {
    title: "提交时间",
    dataIndex: "createdAt",
    width: 160,
    render: (value: string) => formatTimestamp(value)
  },
  {
    title: "完成时间",
    dataIndex: "finishedAt",
    width: 160,
    render: (value: string | undefined) => formatTimestamp(value)
  }
];

const CC_COLUMNS: Array<TableColumn<MyCCRecord>> = [
  {
    title: "审批单",
    dataIndex: "instanceTitle",
    render: (value: string, row) => (
      <Flex align="center" gap="small">
        <FlowIcon name={row.flowIcon} />

        <Flex vertical gap={2}>
          <Flex align="center" gap="small">
            <Text strong={!row.isRead}>{value}</Text>
            {!row.isRead && <Tag color="processing">未读</Tag>}
          </Flex>

          <Text copyable style={{ fontSize: 12 }} type="secondary">{row.instanceNo}</Text>
        </Flex>
      </Flex>
    )
  },
  {
    title: "所属流程",
    dataIndex: "flowName",
    width: 160
  },
  {
    title: "申请人",
    dataIndex: "applicant",
    width: 160,
    render: (value: MyCCRecord["applicant"]) => <UserLabel user={value} />
  },
  {
    title: "抄送节点",
    dataIndex: "nodeName",
    width: 140,
    render: (value: string | undefined) => value ?? "-"
  },
  {
    title: "抄送时间",
    dataIndex: "createdAt",
    width: 160,
    render: (value: string) => formatTimestamp(value)
  }
];

/**
 * The inline search fields for the initiated list.
 */
function InitiatedSearchFields() {
  const { AppField } = useFormContext<InitiatedInstanceSearch>();

  return (
    <>
      <AppField name="keyword">
        {field => <field.Input allowClear noWrapper placeholder="标题 / 单号" />}
      </AppField>

      <AppField name="status">
        {field => (
          <field.Select
            allowClear
            noWrapper
            options={INSTANCE_STATUS_OPTIONS}
            placeholder="状态"
            style={{ minWidth: 110 }}
          />
        )}
      </AppField>
    </>
  );
}

export interface ApprovalMyInstancesPageProps {
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
 * My submissions and my carbon copies. Returned submissions resubmit from
 * the detail drawer; opening an unread CC marks it read.
 */
export function ApprovalMyInstancesPage({ tenantId, title }: ApprovalMyInstancesPageProps) {
  const api = useMyApprovalApi();
  const instanceApi = useInstanceApi();
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const { data: counts, refetch: refetchCounts } = useQuery({
    queryFn: api.getPendingCounts,
    queryKey: [api.getPendingCounts.key, { tenantId }]
  });

  const markCCRead = useMutation({
    mutationFn: instanceApi.markCCRead,
    meta: { shouldShowSuccessFeedback: false, invalidates: [[api.findCCRecords.key] as const] }
  });

  function handleActionCompleted(): void {
    setRefreshToken(token => token + 1);
    void refetchCounts();
  }

  function openCCDetail(row: MyCCRecord): void {
    setDetailTarget(row.instanceId);

    if (!row.isRead) {
      markCCRead.mutateAsync({ instanceId: row.instanceId })
        .then(() => refetchCounts())
        .catch(() => {
          /* surfaced by the http client */
        });
    }
  }

  const initiatedList = (
    <Crud<InitiatedInstance, InitiatedInstanceSearch, SceneValues>
      key={`initiated-${refreshToken}`}
      basicSearch={<InitiatedSearchFields />}
      columnSettings={false}
      defaultSearchValues={{ tenantId }}
      queryFn={api.findInitiated}
      rowKey="instanceId"
      tableColumns={INITIATED_COLUMNS}
      operationColumn={{
        width: 90,
        render(row) {
          return (
            <OperationButton
              color={row.status === "returned" ? "primary" : undefined}
              onClick={() => setDetailTarget(row.instanceId)}
            >
              {row.status === "returned" ? "处理" : "查看"}
            </OperationButton>
          );
        }
      }}
      onRowClick={row => setDetailTarget(row.instanceId)}
    />
  );

  const ccList = (
    <Crud<MyCCRecord, MyCCRecordSearch, SceneValues>
      key={`cc-${refreshToken}`}
      columnSettings={false}
      defaultSearchValues={{ tenantId }}
      queryFn={api.findCCRecords}
      rowKey="ccRecordId"
      tableColumns={CC_COLUMNS}
      operationColumn={{
        width: 90,
        render(row) {
          return (
            <OperationButton onClick={() => openCCDetail(row)}>
              查看
            </OperationButton>
          );
        }
      }}
      onRowClick={row => openCCDetail(row)}
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
                key: "initiated",
                label: "我发起的",
                children: initiatedList
              },
              {
                key: "cc",
                label: (
                  <Badge count={counts?.unreadCcCount ?? 0} offset={[10, 0]} size="small">
                    抄送我的
                  </Badge>
                ),
                children: ccList
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
