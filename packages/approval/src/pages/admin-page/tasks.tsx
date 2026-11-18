import type { CrudBasicSceneFormValues, TableColumn } from "@vef-framework-react/components";
import type { EmptyObject } from "@vef-framework-react/shared";

import type { AdminTask, AdminTaskSearch } from "../../types";

import {
  Crud,
  Flex,
  Input,
  Labeled,
  OperationButton,
  showSuccessMessage,
  Stack,
  Text,
  useFormContext
} from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { useState } from "react";

import { useAdminApprovalApi } from "../../api";
import { formatTimestamp, TaskStatusTag, UserLabel } from "../../components";
import { ActionDialog, ActionFooter } from "../../components/action-dialog";
import { UserActionField, useUserAction } from "../../components/action-dialog/user-selection";
import { TASK_STATUS_OPTIONS } from "../../components/status/labels";
import { PredecessorLabel } from "../../components/user";

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
    render: (value: AdminTask["assignee"], row) => (
      <Flex align="center" gap="small" wrap="wrap">
        <UserLabel user={value} />
        {row.predecessor && <PredecessorLabel user={row.predecessor} />}
      </Flex>
    )
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

interface ReassignModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newAssigneeId: string, reason: string) => Promise<void>;
}

function ReassignForm({ onClose, onConfirm }: Omit<ReassignModalProps, "open">) {
  const selection = useUserAction(onClose);
  const [reason, setReason] = useState("");
  const { submitting, run } = selection;
  const newAssigneeId = selection.userIds[0];

  return (
    <>
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <UserActionField label="改派给" maxCount={1} selection={selection} />

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

      <ActionFooter
        disabled={newAssigneeId === undefined || Boolean(selection.message)}
        okText="改派"
        submitting={submitting}
        onCancel={onClose}
        onOk={() => newAssigneeId !== undefined && void run(() => onConfirm(newAssigneeId, reason))}
      />
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
}: ReassignModalProps) {
  return (
    <ActionDialog open={open} title="改派任务" onClose={onClose}>
      <ReassignForm onClose={onClose} onConfirm={onConfirm} />
    </ActionDialog>
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
