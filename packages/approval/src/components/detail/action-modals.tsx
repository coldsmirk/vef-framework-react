import type { AddAssigneeType, RollbackTarget } from "../../types";

import { Input, Modal, Radio, Select, Stack, Text } from "@vef-framework-react/components";
import { useEffect, useState } from "react";

import { PrincipalSelect } from "../principal";

/**
 * Positions for dynamically added assignees, in display order.
 */
const ADD_ASSIGNEE_TYPE_LABELS: Record<AddAssigneeType, string> = {
  before: "前加签（先于我处理）",
  after: "后加签（我处理后接续）",
  parallel: "并行加签（与我同时处理）"
};

interface ActionModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Drives one confirm-style dialog: local `submitting` while the async confirm
 * runs, closing only on success (errors are surfaced by the mutation layer
 * and keep the dialog open for retry).
 */
function useConfirm(onClose: () => void) {
  const [submitting, setSubmitting] = useState(false);

  async function run(action: () => Promise<void>): Promise<void> {
    setSubmitting(true);

    try {
      await action();
      onClose();
    } catch {
      /* surfaced by the mutation */
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, run };
}

export interface TransferModalProps extends ActionModalProps {
  onConfirm: (transferToId: string, opinion: string) => Promise<void>;
}

/**
 * Transfer the pending task to another user.
 */
export function TransferModal({
  open,
  onClose,
  onConfirm
}: TransferModalProps) {
  const [userIds, setUserIds] = useState<string[]>([]);
  const [opinion, setOpinion] = useState("");
  const { submitting, run } = useConfirm(onClose);

  useEffect(() => {
    if (!open) {
      return;
    }

    setUserIds([]);
    setOpinion("");
  }, [open]);

  const transferToId = userIds[0];

  return (
    <Modal
      confirmLoading={submitting}
      okButtonProps={{ disabled: transferToId === undefined }}
      okText="转办"
      open={open}
      title="转办"
      onCancel={onClose}
      onOk={() => transferToId !== undefined && run(() => onConfirm(transferToId, opinion))}
    >
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Stack gap={4}>
          <Text>转办给</Text>
          <PrincipalSelect kind="user" maxCount={1} value={userIds} onChange={setUserIds} />
        </Stack>

        <Stack gap={4}>
          <Text>转办说明</Text>

          <Input.TextArea
            maxLength={2000}
            placeholder="请输入转办说明（可选）"
            rows={3}
            value={opinion}
            onChange={event => setOpinion(event.target.value)}
          />
        </Stack>
      </Stack>
    </Modal>
  );
}

export interface RollbackModalProps extends ActionModalProps {
  targets: RollbackTarget[];
  onConfirm: (targetNodeId: string, opinion: string) => Promise<void>;
}

/**
 * Send the instance back to a previously traversed node. Targets are resolved
 * server-side — exactly the set the engine will accept.
 */
export function RollbackModal({
  open,
  onClose,
  targets,
  onConfirm
}: RollbackModalProps) {
  const [targetNodeId, setTargetNodeId] = useState<string>();
  const [opinion, setOpinion] = useState("");
  const { submitting, run } = useConfirm(onClose);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTargetNodeId(targets.length === 1 ? targets[0]?.nodeId : undefined);
    setOpinion("");
  }, [open, targets]);

  return (
    <Modal
      confirmLoading={submitting}
      okButtonProps={{ disabled: targetNodeId === undefined }}
      okText="回退"
      open={open}
      title="回退"
      onCancel={onClose}
      onOk={() => targetNodeId !== undefined && run(() => onConfirm(targetNodeId, opinion))}
    >
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Stack gap={4}>
          <Text>回退至</Text>

          <Select
            placeholder="选择回退节点"
            style={{ width: "100%" }}
            value={targetNodeId}
            options={targets.map(target => {
              return { label: target.name, value: target.nodeId };
            })}
            onChange={setTargetNodeId}
          />
        </Stack>

        <Stack gap={4}>
          <Text>回退说明</Text>

          <Input.TextArea
            maxLength={2000}
            placeholder="请输入回退说明（可选）"
            rows={3}
            value={opinion}
            onChange={event => setOpinion(event.target.value)}
          />
        </Stack>
      </Stack>
    </Modal>
  );
}

export interface AddAssigneeModalProps extends ActionModalProps {
  /**
   * The positions the node allows, from the server-resolved viewer task.
   */
  allowedTypes: AddAssigneeType[];
  onConfirm: (userIds: string[], addType: AddAssigneeType) => Promise<void>;
}

/**
 * Dynamically add assignees around the pending task.
 */
export function AddAssigneeModal({
  open,
  onClose,
  allowedTypes,
  onConfirm
}: AddAssigneeModalProps) {
  const [userIds, setUserIds] = useState<string[]>([]);
  const [addType, setAddType] = useState<AddAssigneeType>();
  const { submitting, run } = useConfirm(onClose);

  useEffect(() => {
    if (!open) {
      return;
    }

    setUserIds([]);
    setAddType(allowedTypes.length === 1 ? allowedTypes[0] : undefined);
  }, [open, allowedTypes]);

  const ready = userIds.length > 0 && addType !== undefined;

  return (
    <Modal
      confirmLoading={submitting}
      okButtonProps={{ disabled: !ready }}
      okText="加签"
      open={open}
      title="加签"
      onCancel={onClose}
      onOk={() => {
        if (userIds.length > 0 && addType !== undefined) {
          void run(() => onConfirm(userIds, addType));
        }
      }}
    >
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Stack gap={4}>
          <Text>加签人员</Text>
          <PrincipalSelect kind="user" maxCount={50} value={userIds} onChange={setUserIds} />
        </Stack>

        <Stack gap={4}>
          <Text>加签方式</Text>

          <Radio.Group
            value={addType}
            options={allowedTypes.map(type => {
              return { label: ADD_ASSIGNEE_TYPE_LABELS[type], value: type };
            })}
            onChange={event => {
              const next = event.target.value;

              if (next === "before" || next === "after" || next === "parallel") {
                setAddType(next);
              }
            }}
          />
        </Stack>
      </Stack>
    </Modal>
  );
}

export interface CCModalProps extends ActionModalProps {
  onConfirm: (ccUserIds: string[]) => Promise<void>;
}

/**
 * Manually carbon-copy the instance to more recipients.
 */
export function CCModal({
  open,
  onClose,
  onConfirm
}: CCModalProps) {
  const [userIds, setUserIds] = useState<string[]>([]);
  const { submitting, run } = useConfirm(onClose);

  useEffect(() => {
    if (open) {
      setUserIds([]);
    }
  }, [open]);

  return (
    <Modal
      confirmLoading={submitting}
      okButtonProps={{ disabled: userIds.length === 0 }}
      okText="抄送"
      open={open}
      title="抄送"
      onCancel={onClose}
      onOk={() => userIds.length > 0 && run(() => onConfirm(userIds))}
    >
      <Stack gap={4} style={{ paddingBlock: 8 }}>
        <Text>抄送给</Text>
        <PrincipalSelect kind="user" maxCount={50} value={userIds} onChange={setUserIds} />
      </Stack>
    </Modal>
  );
}

/**
 * One pending task that can be urged.
 */
export interface UrgeTarget {
  taskId: string;
  assigneeName: string;
  nodeName: string;
}

export interface UrgeModalProps extends ActionModalProps {
  targets: UrgeTarget[];
  onConfirm: (taskId: string, message: string) => Promise<void>;
}

/**
 * Send an urge notification to a pending assignee.
 */
export function UrgeModal({
  open,
  onClose,
  targets,
  onConfirm
}: UrgeModalProps) {
  const [taskId, setTaskId] = useState<string>();
  const [message, setMessage] = useState("");
  const { submitting, run } = useConfirm(onClose);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTaskId(targets.length === 1 ? targets[0]?.taskId : undefined);
    setMessage("");
  }, [open, targets]);

  return (
    <Modal
      confirmLoading={submitting}
      okButtonProps={{ disabled: taskId === undefined }}
      okText="催办"
      open={open}
      title="催办"
      onCancel={onClose}
      onOk={() => taskId !== undefined && run(() => onConfirm(taskId, message))}
    >
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Stack gap={4}>
          <Text>催办对象</Text>

          <Select
            placeholder="选择待处理任务"
            style={{ width: "100%" }}
            value={taskId}
            options={targets.map(target => {
              return { label: `${target.assigneeName}（${target.nodeName}）`, value: target.taskId };
            })}
            onChange={setTaskId}
          />
        </Stack>

        <Stack gap={4}>
          <Text>催办消息</Text>

          <Input.TextArea
            maxLength={500}
            placeholder="请输入催办消息（可选）"
            rows={3}
            value={message}
            onChange={event => setMessage(event.target.value)}
          />
        </Stack>
      </Stack>
    </Modal>
  );
}

export interface ReasonModalProps extends ActionModalProps {
  title: string;
  okText: string;
  /**
   * Renders the ok button in danger style (terminate).
   */
  danger?: boolean;
  placeholder?: string;
  onConfirm: (reason: string) => Promise<void>;
}

/**
 * A single reason input, shared by withdraw / terminate style actions.
 */
export function ReasonModal({
  open,
  onClose,
  title,
  okText,
  danger,
  placeholder,
  onConfirm
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const { submitting, run } = useConfirm(onClose);

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open]);

  return (
    <Modal
      confirmLoading={submitting}
      okButtonProps={danger ? { danger: true } : undefined}
      okText={okText}
      open={open}
      title={title}
      onCancel={onClose}
      onOk={() => run(() => onConfirm(reason))}
    >
      <Stack gap={4} style={{ paddingBlock: 8 }}>
        <Input.TextArea
          maxLength={2000}
          placeholder={placeholder ?? "请输入原因（可选）"}
          rows={3}
          value={reason}
          onChange={event => setReason(event.target.value)}
        />
      </Stack>
    </Modal>
  );
}
