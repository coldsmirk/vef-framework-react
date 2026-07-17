import type { CrudBasicSceneFormValues, TableColumn } from "@vef-framework-react/components";
import type { EmptyObject } from "@vef-framework-react/shared";

import type { AdminTask, AdminTaskSearch } from "../../types";

import {
  Crud,
  Input,
  Labeled,
  Modal,
  OperationButton,
  showSuccessMessage,
  Stack,
  Text,
  useFormContext
} from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { useEffect, useState } from "react";

import { useAdminApprovalApi } from "../../api";
import { formatTimestamp, PrincipalSelect, TaskStatusTag, UserLabel } from "../../components";
import { TASK_STATUS_OPTIONS } from "../../components/status/labels";

type SceneValues = CrudBasicSceneFormValues<EmptyObject, EmptyObject>;

const COLUMNS: Array<TableColumn<AdminTask>> = [
  {
    title: "审批单",
    dataIndex: "instanceTitle",
    render: (value: string) => <Text>{value}</Text>
  },
  {
    title: "所属流程",
    dataIndex: "flowName",
    width: 150
  },
  {
    title: "节点",
    dataIndex: "nodeName",
    width: 130
  },
  {
    title: "处理人",
    dataIndex: "assignee",
    width: 150,
    render: (value: AdminTask["assignee"]) => <UserLabel user={value} />
  },
  {
    title: "状态",
    dataIndex: "status",
    width: 100,
    render: (value: AdminTask["status"]) => <TaskStatusTag status={value} />
  },
  {
    title: "创建时间",
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

function TaskSearchFields() {
  const { AppField } = useFormContext<AdminTaskSearch>();

  return (
    <>
      <AppField name="assigneeId">
        {field => <field.Input allowClear noWrapper placeholder="处理人 ID" />}
      </AppField>

      <AppField name="instanceId">
        {field => <field.Input allowClear noWrapper placeholder="实例 ID" />}
      </AppField>

      <AppField name="status">
        {field => (
          <field.Select
            allowClear
            noWrapper
            options={TASK_STATUS_OPTIONS}
            placeholder="状态"
            style={{ minWidth: 110 }}
          />
        )}
      </AppField>
    </>
  );
}

/**
 * Reassign a pending task to a different user.
 */
function ReassignModal({
  open,
  onClose,
  onConfirm
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (newAssigneeId: string, reason: string) => Promise<void>;
}) {
  const [userIds, setUserIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setUserIds([]);
    setReason("");
  }, [open]);

  const newAssigneeId = userIds[0];

  return (
    <Modal
      confirmLoading={submitting}
      okButtonProps={{ disabled: newAssigneeId === undefined }}
      okText="改派"
      open={open}
      title="改派任务"
      onCancel={onClose}
      onOk={async () => {
        if (newAssigneeId === undefined) {
          return;
        }

        setSubmitting(true);

        try {
          await onConfirm(newAssigneeId, reason);
          onClose();
        } catch {
          /* surfaced by the http client */
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Labeled label="改派给">
          <PrincipalSelect kind="user" maxCount={1} value={userIds} onChange={setUserIds} />
        </Labeled>

        <Labeled label="改派原因">
          <Input.TextArea
            maxLength={2000}
            placeholder="请输入改派原因（可选）"
            rows={3}
            value={reason}
            onChange={event => setReason(event.target.value)}
          />
        </Labeled>
      </Stack>
    </Modal>
  );
}

export interface TasksPanelProps {
  reassignPermission: string;
}

/**
 * Cross-user task supervision with admin reassignment for pending tasks.
 */
export function TasksPanel({ reassignPermission }: TasksPanelProps) {
  const api = useAdminApprovalApi();
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const reassign = useMutation({
    mutationFn: api.reassignTask,
    meta: { shouldShowSuccessFeedback: false, invalidates: [[api.findTasks.key] as const] }
  });

  return (
    <>
      <Crud<AdminTask, AdminTaskSearch, SceneValues>
        key={String(refreshToken)}
        basicSearch={<TaskSearchFields />}
        columnSettings={{ storageKey: "approval.admin.tasks" }}
        queryFn={api.findTasks}
        rowKey="taskId"
        tableColumns={COLUMNS}
        operationColumn={{
          width: 100,
          render(row) {
            if (row.status !== "pending") {
              return null;
            }

            return (
              <OperationButton
                color="primary"
                requiredPermissions={reassignPermission}
                onClick={() => setReassignTarget(row.taskId)}
              >
                改派
              </OperationButton>
            );
          }
        }}
      />

      <ReassignModal
        open={reassignTarget !== null}
        onClose={() => setReassignTarget(null)}
        onConfirm={async (newAssigneeId, reason) => {
          if (reassignTarget === null) {
            return;
          }

          await reassign.mutateAsync({
            taskId: reassignTarget,
            newAssigneeId,
            reason: reason.trim() || undefined
          });
          showSuccessMessage("已改派");
          setRefreshToken(token => token + 1);
        }}
      />
    </>
  );
}
