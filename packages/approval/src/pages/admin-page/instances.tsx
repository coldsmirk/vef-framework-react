import type { CrudBasicSceneFormValues, TableColumn } from "@vef-framework-react/components";
import type { EmptyObject } from "@vef-framework-react/shared";

import type { AdminInstance, AdminInstanceSearch } from "../../types";

import { Crud, Drawer, Flex, OperationButton, showSuccessMessage, Text, useFormContext } from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { useState } from "react";

import { useAdminApprovalApi } from "../../api";
import { AdminInstanceDetailPanel, formatTimestamp, InstanceStatusTag, UserLabel } from "../../components";
import { ReasonModal } from "../../components/detail/action-modals";
import { INSTANCE_STATUS_OPTIONS } from "../../components/status/labels";

type SceneValues = CrudBasicSceneFormValues<EmptyObject, EmptyObject>;

const COLUMNS: Array<TableColumn<AdminInstance>> = [
  {
    title: "审批单",
    dataIndex: "title",
    render: (value: string, row) => (
      <Flex vertical gap={2}>
        <Text>{value}</Text>
        <Text copyable style={{ fontSize: 12 }} type="secondary">{row.instanceNo}</Text>
      </Flex>
    )
  },
  {
    title: "所属流程",
    dataIndex: "flowName",
    width: 150
  },
  {
    title: "申请人",
    dataIndex: "applicant",
    width: 150,
    render: (value: AdminInstance["applicant"]) => <UserLabel user={value} />
  },
  {
    title: "状态",
    dataIndex: "status",
    width: 100,
    render: (value: AdminInstance["status"]) => <InstanceStatusTag status={value} />
  },
  {
    title: "当前节点",
    dataIndex: "currentNodeName",
    width: 130,
    render: (value: string | undefined) => value ?? "-"
  },
  {
    title: "提交时间",
    dataIndex: "createdAt",
    width: 160,
    render: (value: string) => formatTimestamp(value)
  }
];

function InstanceSearchFields() {
  const { AppField } = useFormContext<AdminInstanceSearch>();

  return (
    <>
      <AppField name="keyword">
        {field => <field.Input allowClear noWrapper placeholder="标题 / 单号" />}
      </AppField>

      <AppField name="applicantId">
        {field => <field.Input allowClear noWrapper placeholder="申请人 ID" />}
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

export interface InstancesPanelProps {
  detailPermission: string;
  terminatePermission: string;
}

/**
 * Cross-user instance supervision: the paginated list, the read-only admin
 * detail (with the audit trail), and force termination.
 */
export function InstancesPanel({ detailPermission, terminatePermission }: InstancesPanelProps) {
  const api = useAdminApprovalApi();
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const terminate = useMutation({
    mutationFn: api.terminateInstance,
    meta: { shouldShowSuccessFeedback: false, invalidates: [[api.findInstances.key] as const] }
  });

  return (
    <>
      <Crud<AdminInstance, AdminInstanceSearch, SceneValues>
        key={String(refreshToken)}
        basicSearch={<InstanceSearchFields />}
        columnSettings={{ storageKey: "approval.admin.instances" }}
        queryFn={api.findInstances}
        rowKey="instanceId"
        tableColumns={COLUMNS}
        operationColumn={{
          width: 160,
          render(row) {
            return (
              <>
                <OperationButton
                  color="primary"
                  requiredPermissions={detailPermission}
                  onClick={() => setDetailTarget(row.instanceId)}
                >
                  详情
                </OperationButton>

                {row.status === "running" && (
                  <OperationButton
                    color="danger"
                    requiredPermissions={terminatePermission}
                    onClick={() => setTerminateTarget(row.instanceId)}
                  >
                    终止
                  </OperationButton>
                )}
              </>
            );
          }
        }}
      />

      <Drawer
        destroyOnHidden
        open={detailTarget !== null}
        placement="right"
        size={880}
        title="审批详情"
        onClose={() => setDetailTarget(null)}
      >
        {detailTarget !== null && <AdminInstanceDetailPanel instanceId={detailTarget} />}
      </Drawer>

      <ReasonModal
        danger
        okText="终止"
        open={terminateTarget !== null}
        placeholder="请输入终止原因（可选）"
        title="终止审批单"
        onClose={() => setTerminateTarget(null)}
        onConfirm={async reason => {
          if (terminateTarget === null) {
            return;
          }

          await terminate.mutateAsync({ instanceId: terminateTarget, reason: reason.trim() || undefined });
          showSuccessMessage("已终止");
          setRefreshToken(token => token + 1);
        }}
      />
    </>
  );
}
