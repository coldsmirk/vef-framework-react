import type { TableColumn } from "@vef-framework-react/components";

import type { Flow, FlowVersion } from "../../types";

import { Drawer, OperationButton, showSuccessMessage, Table, Text } from "@vef-framework-react/components";
import { useMutation, useQuery } from "@vef-framework-react/core";

import { useFlowApi } from "../../api";
import { formatTimestamp, VersionStatusTag } from "../../components";

export interface FlowVersionsDrawerProps {
  flow: Flow | null;
  open: boolean;
  /**
   * Permission code gating the publish action.
   */
  publishPermission: string;
  onClose: () => void;
}

/**
 * The version history of one flow: every deploy in descending order, with
 * publish for drafts. Publishing archives the previously published version;
 * running instances keep the version they started on.
 */
export function FlowVersionsDrawer({
  flow,
  open,
  publishPermission,
  onClose
}: FlowVersionsDrawerProps) {
  const api = useFlowApi();

  const {
    data: versions,
    isLoading,
    refetch
  } = useQuery({
    queryFn: api.findVersions,
    queryKey: [api.findVersions.key, { flowId: flow?.id ?? "" }],
    enabled: open && flow !== null
  });

  // Publishing also refreshes the flow list behind the drawer (its
  // current-version column) through query invalidation.
  const publishVersion = useMutation({
    mutationFn: api.publishVersion,
    meta: { shouldShowSuccessFeedback: false, invalidates: [[api.findFlows.key] as const] }
  });

  const columns: Array<TableColumn<FlowVersion>> = [
    {
      title: "版本",
      dataIndex: "version",
      width: 90,
      render: (value: number) => <Text strong>{`v${value}`}</Text>
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: FlowVersion["status"]) => <VersionStatusTag status={value} />
    },
    {
      title: "说明",
      dataIndex: "description",
      ellipsis: true,
      render: (value: string | null | undefined) => value ?? "-"
    },
    {
      title: "存储模式",
      dataIndex: "storageMode",
      width: 110,
      render: (value: FlowVersion["storageMode"]) => value === "table" ? "独立表" : "JSON"
    },
    {
      title: "部署时间",
      dataIndex: "createdAt",
      width: 160,
      render: (value: string | undefined) => formatTimestamp(value)
    },
    {
      title: "发布时间",
      dataIndex: "publishedAt",
      width: 160,
      render: (value: string | null | undefined) => formatTimestamp(value)
    },
    {
      title: "操作",
      dataIndex: "id",
      width: 100,
      render: (_value, row) => row.status === "draft"
        ? (
            <OperationButton
              confirmable
              color="primary"
              confirmDescription="发布后新发起的审批将立即使用该版本，确定发布？"
              requiredPermissions={publishPermission}
              onClick={async () => {
                try {
                  await publishVersion.mutateAsync({ versionId: row.id });
                  showSuccessMessage("版本已发布");
                  await refetch();
                } catch {
                  /* surfaced by the http client */
                }
              }}
            >
              发布
            </OperationButton>
          )
        : null
    }
  ];

  return (
    <Drawer
      open={open}
      size={720}
      title={flow ? `版本历史 · ${flow.name}` : "版本历史"}
      onClose={onClose}
    >
      <Table<FlowVersion>
        columns={columns}
        dataSource={versions ?? []}
        loading={isLoading}
        pagination={false}
        rowKey="id"
        size="small"
      />
    </Drawer>
  );
}
