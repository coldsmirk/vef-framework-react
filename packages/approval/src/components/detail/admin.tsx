import type { TableColumn } from "@vef-framework-react/components";

import type { AdminActionLog } from "../../types";

import { Empty, Flex, pageSizeOptions, Spin, Stack, SYMBOL_PAGINATION, Table, Tabs, Tag, Text } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { useState } from "react";

import { useAdminApprovalApi } from "../../api";
import { InstanceFlowGraphViewer } from "../flow-graph";
import { InstanceFormPanel } from "../form-panel";
import { formatTimestamp } from "../format";
import { ACTIVITY_ACTION_LABELS } from "../status/labels";
import { InstanceTimeline } from "../timeline";
import { UserGroup, UserLabel } from "../user";
import { InstanceHeader } from "./index";

const ACTION_LOG_COLUMNS: Array<TableColumn<AdminActionLog>> = [
  {
    title: "操作",
    dataIndex: "action",
    width: 110,
    render: (value: AdminActionLog["action"]) => <Tag>{ACTIVITY_ACTION_LABELS[value]}</Tag>
  },
  {
    title: "操作人",
    dataIndex: "operator",
    width: 160,
    render: (value: AdminActionLog["operator"]) => <UserLabel user={value} />
  },
  {
    title: "详情",
    dataIndex: "logId",
    render: (_value, row) => {
      const people = [...row.addedAssignees ?? [], ...row.removedAssignees ?? [], ...row.ccUsers ?? []];

      return (
        <Stack gap={4}>
          {row.transferTo
            && <Text type="secondary">{`转办给 ${row.transferTo.name || row.transferTo.id}`}</Text>}

          {people.length > 0 && <UserGroup avatarSize={20} users={people} />}
          {row.opinion && <Text style={{ whiteSpace: "pre-wrap" }}>{row.opinion}</Text>}
        </Stack>
      );
    }
  },
  {
    title: "时间",
    dataIndex: "createdAt",
    width: 160,
    render: (value: string) => formatTimestamp(value)
  }
];

/**
 * The paginated raw audit trail of one instance.
 */
function ActionLogPanel({ instanceId }: { instanceId: string }) {
  const api = useAdminApprovalApi();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery({
    queryFn: api.findActionLogs,
    queryKey: [api.findActionLogs.key, { instanceId, [SYMBOL_PAGINATION]: { page, size: pageSize } }]
  });

  return (
    <Table<AdminActionLog>
      columns={ACTION_LOG_COLUMNS}
      dataSource={data?.items ?? []}
      loading={isLoading}
      rowKey="logId"
      size="small"
      pagination={{
        current: page,
        pageSize,
        total: data?.total ?? 0,
        showSizeChanger: true,
        pageSizeOptions,
        onChange: (nextPage, nextSize) => {
          setPage(nextPage);
          setPageSize(nextSize);
        }
      }}
    />
  );
}

export interface AdminInstanceDetailPanelProps {
  instanceId: string;
}

/**
 * The supervision detail of an instance: the same header / form / timeline /
 * graph projections as the self-service view — but fully read-only, with no
 * field-permission clamp (admins see every field) — plus the paginated raw
 * audit trail. Admin write actions (terminate, reassign) live on the admin
 * page rows, not in this panel.
 */
export function AdminInstanceDetailPanel({ instanceId }: AdminInstanceDetailPanelProps) {
  const api = useAdminApprovalApi();

  const { data: detail, isLoading } = useQuery({
    queryFn: api.getInstanceDetail,
    queryKey: [api.getInstanceDetail.key, { instanceId }]
  });

  if (isLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 240 }}>
        <Spin />
      </Flex>
    );
  }

  if (!detail) {
    return <Empty description="未找到审批单" />;
  }

  const { instance } = detail;

  return (
    <Stack gap={20}>
      <InstanceHeader
        applicant={instance.applicant}
        businessRef={instance.businessRef}
        createdAt={instance.createdAt}
        currentNodeName={instance.currentNodeName}
        finishedAt={instance.finishedAt}
        flowCode={instance.flowCode}
        flowName={instance.flowName}
        instanceNo={instance.instanceNo}
        labels={instance.labels}
        status={instance.status}
        title={instance.title}
      />

      <Tabs
        items={[
          {
            key: "form",
            label: "审批表单",
            children: <InstanceFormPanel disabled formData={instance.formData} schema={detail.formSchema} />
          },
          {
            key: "timeline",
            label: "流转记录",
            children: <InstanceTimeline timeline={detail.timeline} />
          },
          {
            key: "graph",
            label: "流程图",
            children: <InstanceFlowGraphViewer flowGraph={detail.flowGraph} />
          },
          {
            key: "logs",
            label: "操作日志",
            children: <ActionLogPanel instanceId={instanceId} />
          }
        ]}
      />
    </Stack>
  );
}
