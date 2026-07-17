import type { CrudBasicSceneFormValues, TableColumn } from "@vef-framework-react/components";
import type { EmptyObject } from "@vef-framework-react/shared";

import type { AdminBusinessProjection, AdminBusinessProjectionSearch } from "../../types";

import { Crud, Flex, OperationButton, showSuccessMessage, Text, Tooltip, useFormContext } from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { useState } from "react";

import { useAdminApprovalApi } from "../../api";
import { formatTimestamp, InstanceStatusTag, ProjectionStatusTag } from "../../components";
import { BINDING_PROJECTION_STATUS_OPTIONS } from "../../components/status/labels";

type SceneValues = CrudBasicSceneFormValues<EmptyObject, EmptyObject>;

const COLUMNS: Array<TableColumn<AdminBusinessProjection>> = [
  {
    title: "业务表",
    dataIndex: "businessTable",
    width: 180,
    render: (value: string, row) => (
      <Flex vertical gap={2}>
        <Text code>{value}</Text>
        <Text style={{ fontSize: 12 }} type="secondary">{JSON.stringify(row.recordKey)}</Text>
      </Flex>
    )
  },
  {
    title: "目标状态",
    dataIndex: "desiredStatus",
    width: 100,
    render: (value: AdminBusinessProjection["desiredStatus"]) => <InstanceStatusTag status={value} />
  },
  {
    title: "写入状态",
    dataIndex: "status",
    width: 110,
    render: (value: AdminBusinessProjection["status"], row) => (
      <Flex align="center" gap="small">
        <ProjectionStatusTag status={value} />

        {row.lastError !== undefined && row.lastError !== "" && (
          <Tooltip title={row.lastError}>
            <Text type="danger">!</Text>
          </Tooltip>
        )}
      </Flex>
    )
  },
  {
    title: "版本",
    dataIndex: "appliedRevision",
    width: 110,
    align: "center",
    render: (value: number, row) => <Text>{`${value} / ${row.desiredRevision}`}</Text>
  },
  {
    title: "重试次数",
    dataIndex: "attemptCount",
    width: 90,
    align: "center"
  },
  {
    title: "下次重试",
    dataIndex: "nextAttemptAt",
    width: 160,
    render: (value: string | undefined) => formatTimestamp(value)
  },
  {
    title: "更新时间",
    dataIndex: "updatedAt",
    width: 160,
    render: (value: string) => formatTimestamp(value)
  }
];

function ProjectionSearchFields() {
  const { AppField } = useFormContext<AdminBusinessProjectionSearch>();

  return (
    <AppField name="status">
      {field => (
        <field.Select
          allowClear
          noWrapper
          options={BINDING_PROJECTION_STATUS_OPTIONS}
          placeholder="写入状态"
          style={{ minWidth: 130 }}
        />
      )}
    </AppField>
  );
}

export interface ProjectionsPanelProps {
  retryPermission: string;
}

/**
 * Business write-back convergence: every bound record's desired vs applied
 * state, with immediate retry for failed eventual projections.
 */
export function ProjectionsPanel({ retryPermission }: ProjectionsPanelProps) {
  const api = useAdminApprovalApi();
  const [refreshToken, setRefreshToken] = useState(0);

  const retry = useMutation({
    mutationFn: api.retryBusinessProjection,
    meta: { shouldShowSuccessFeedback: false, invalidates: [[api.findBusinessProjections.key] as const] }
  });

  return (
    <Crud<AdminBusinessProjection, AdminBusinessProjectionSearch, SceneValues>
      key={String(refreshToken)}
      basicSearch={<ProjectionSearchFields />}
      columnSettings={{ storageKey: "approval.admin.projections" }}
      queryFn={api.findBusinessProjections}
      rowKey="projectionId"
      tableColumns={COLUMNS}
      operationColumn={{
        width: 110,
        render(row) {
          if (row.status !== "failed") {
            return null;
          }

          return (
            <OperationButton
              color="primary"
              requiredPermissions={retryPermission}
              onClick={async () => {
                try {
                  await retry.mutateAsync({ projectionId: row.projectionId });
                  showSuccessMessage("已触发重试");
                  setRefreshToken(token => token + 1);
                } catch {
                  /* surfaced by the http client */
                }
              }}
            >
              立即重试
            </OperationButton>
          );
        }
      }}
    />
  );
}
