import type { AddAssigneeType, RemovableAssignee, RollbackTarget } from "../../types";

import { Input, Labeled, Radio, Select, Stack } from "@vef-framework-react/components";
import { useState } from "react";

import { ActionDialog, ActionFooter, useConfirm } from "../action-dialog";
import { PrincipalSelect } from "../principal";
import { isTaskStatus } from "../status";
import { TASK_STATUS_LABELS } from "../status/labels";

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

// Each modal below is a thin ActionDialog shell around a form that owns the
// draft; see ActionDialog for why the draft must not live beside the Modal.

export interface TransferModalProps extends ActionModalProps {
  onConfirm: (transferToId: string, opinion: string) => Promise<void>;
}

function TransferForm({ onClose, onConfirm }: Omit<TransferModalProps, "open">) {
  const [userIds, setUserIds] = useState<string[]>([]);
  const [opinion, setOpinion] = useState("");
  const { submitting, run } = useConfirm(onClose);
  const transferToId = userIds[0];

  return (
    <>
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Labeled label="转办给">
          <PrincipalSelect kind="user" maxCount={1} value={userIds} onChange={setUserIds} />
        </Labeled>

        <Labeled label="转办说明">
          <Input.TextArea
            maxLength={2000}
            placeholder="请输入转办说明（可选）"
            rows={3}
            value={opinion}
            onChange={event => setOpinion(event.target.value)}
          />
        </Labeled>
      </Stack>

      <ActionFooter
        disabled={transferToId === undefined}
        okText="转办"
        submitting={submitting}
        onCancel={onClose}
        onOk={() => transferToId !== undefined && void run(() => onConfirm(transferToId, opinion))}
      />
    </>
  );
}

/**
 * Transfer the pending task to another user.
 */
export function TransferModal({
  open,
  onClose,
  onConfirm
}: TransferModalProps) {
  return (
    <ActionDialog open={open} title="转办" onClose={onClose}>
      <TransferForm onClose={onClose} onConfirm={onConfirm} />
    </ActionDialog>
  );
}

export interface RollbackModalProps extends ActionModalProps {
  targets: RollbackTarget[];
  onConfirm: (targetNodeId: string, opinion: string) => Promise<void>;
}

function RollbackForm({
  targets,
  onClose,
  onConfirm
}: Omit<RollbackModalProps, "open">) {
  const [targetNodeId, setTargetNodeId] = useState(() => targets.length === 1 ? targets[0]?.nodeId : undefined);
  const [opinion, setOpinion] = useState("");
  const { submitting, run } = useConfirm(onClose);

  return (
    <>
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Labeled label="回退至">
          <Select
            placeholder="选择回退节点"
            style={{ width: "100%" }}
            value={targetNodeId}
            options={targets.map(target => {
              return { label: target.name, value: target.nodeId };
            })}
            onChange={setTargetNodeId}
          />
        </Labeled>

        <Labeled label="回退说明">
          <Input.TextArea
            maxLength={2000}
            placeholder="请输入回退说明（可选）"
            rows={3}
            value={opinion}
            onChange={event => setOpinion(event.target.value)}
          />
        </Labeled>
      </Stack>

      <ActionFooter
        disabled={targetNodeId === undefined}
        okText="回退"
        submitting={submitting}
        onCancel={onClose}
        onOk={() => targetNodeId !== undefined && void run(() => onConfirm(targetNodeId, opinion))}
      />
    </>
  );
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
  return (
    <ActionDialog open={open} title="回退" onClose={onClose}>
      <RollbackForm targets={targets} onClose={onClose} onConfirm={onConfirm} />
    </ActionDialog>
  );
}

export interface AddAssigneeModalProps extends ActionModalProps {
  /**
   * The positions the node allows, from the server-resolved viewer task.
   */
  allowedTypes: AddAssigneeType[];
  onConfirm: (userIds: string[], addType: AddAssigneeType) => Promise<void>;
}

function AddAssigneeForm({
  allowedTypes,
  onClose,
  onConfirm
}: Omit<AddAssigneeModalProps, "open">) {
  const [userIds, setUserIds] = useState<string[]>([]);
  const [addType, setAddType] = useState(() => allowedTypes.length === 1 ? allowedTypes[0] : undefined);
  const { submitting, run } = useConfirm(onClose);

  return (
    <>
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Labeled label="加签人员">
          <PrincipalSelect kind="user" maxCount={50} value={userIds} onChange={setUserIds} />
        </Labeled>

        <Labeled label="加签方式">
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
        </Labeled>
      </Stack>

      <ActionFooter
        disabled={userIds.length === 0 || addType === undefined}
        okText="加签"
        submitting={submitting}
        onCancel={onClose}
        onOk={() => {
          if (userIds.length > 0 && addType !== undefined) {
            void run(() => onConfirm(userIds, addType));
          }
        }}
      />
    </>
  );
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
  return (
    <ActionDialog open={open} title="加签" onClose={onClose}>
      <AddAssigneeForm allowedTypes={allowedTypes} onClose={onClose} onConfirm={onConfirm} />
    </ActionDialog>
  );
}

export interface RemoveAssigneeModalProps extends ActionModalProps {
  /**
   * The removable peers, resolved server-side — exactly the set the
   * remove-assignee command authorizes.
   */
  targets: RemovableAssignee[];
  onConfirm: (taskId: string) => Promise<void>;
}

function RemoveAssigneeForm({
  targets,
  onClose,
  onConfirm
}: Omit<RemoveAssigneeModalProps, "open">) {
  const [taskId, setTaskId] = useState(() => targets.length === 1 ? targets[0]?.taskId : undefined);
  const { submitting, run } = useConfirm(onClose);

  return (
    <>
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Labeled hint="移除后该审批人不再参与本节点审批。" label="移除审批人">
          <Select
            placeholder="选择要移除的审批人"
            style={{ width: "100%" }}
            value={taskId}
            options={targets.map(target => {
              const statusLabel = isTaskStatus(target.status) ? TASK_STATUS_LABELS[target.status] : target.status;

              return {
                label: `${target.assignee.name || target.assignee.id}（${statusLabel}）`,
                value: target.taskId
              };
            })}
            onChange={setTaskId}
          />
        </Labeled>
      </Stack>

      <ActionFooter
        danger
        disabled={taskId === undefined}
        okText="减签"
        submitting={submitting}
        onCancel={onClose}
        onOk={() => taskId !== undefined && void run(() => onConfirm(taskId))}
      />
    </>
  );
}

/**
 * Remove a peer assignee from the current node by canceling their task.
 */
export function RemoveAssigneeModal({
  open,
  onClose,
  targets,
  onConfirm
}: RemoveAssigneeModalProps) {
  return (
    <ActionDialog open={open} title="减签" onClose={onClose}>
      <RemoveAssigneeForm targets={targets} onClose={onClose} onConfirm={onConfirm} />
    </ActionDialog>
  );
}

export interface CCModalProps extends ActionModalProps {
  onConfirm: (ccUserIds: string[]) => Promise<void>;
}

function CCForm({ onClose, onConfirm }: Omit<CCModalProps, "open">) {
  const [userIds, setUserIds] = useState<string[]>([]);
  const { submitting, run } = useConfirm(onClose);

  return (
    <>
      <Stack gap={4} style={{ paddingBlock: 8 }}>
        <Labeled label="抄送给">
          <PrincipalSelect kind="user" maxCount={50} value={userIds} onChange={setUserIds} />
        </Labeled>
      </Stack>

      <ActionFooter
        disabled={userIds.length === 0}
        okText="抄送"
        submitting={submitting}
        onCancel={onClose}
        onOk={() => userIds.length > 0 && void run(() => onConfirm(userIds))}
      />
    </>
  );
}

/**
 * Manually carbon-copy the instance to more recipients.
 */
export function CCModal({
  open,
  onClose,
  onConfirm
}: CCModalProps) {
  return (
    <ActionDialog open={open} title="抄送" onClose={onClose}>
      <CCForm onClose={onClose} onConfirm={onConfirm} />
    </ActionDialog>
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

function UrgeForm({
  targets,
  onClose,
  onConfirm
}: Omit<UrgeModalProps, "open">) {
  const [taskId, setTaskId] = useState(() => targets.length === 1 ? targets[0]?.taskId : undefined);
  const [message, setMessage] = useState("");
  const { submitting, run } = useConfirm(onClose);

  return (
    <>
      <Stack gap={12} style={{ paddingBlock: 8 }}>
        <Labeled label="催办对象">
          <Select
            placeholder="选择待处理任务"
            style={{ width: "100%" }}
            value={taskId}
            options={targets.map(target => {
              return { label: `${target.assigneeName}（${target.nodeName}）`, value: target.taskId };
            })}
            onChange={setTaskId}
          />
        </Labeled>

        <Labeled label="催办消息">
          <Input.TextArea
            maxLength={500}
            placeholder="请输入催办消息（可选）"
            rows={3}
            value={message}
            onChange={event => setMessage(event.target.value)}
          />
        </Labeled>
      </Stack>

      <ActionFooter
        disabled={taskId === undefined}
        okText="催办"
        submitting={submitting}
        onCancel={onClose}
        onOk={() => taskId !== undefined && void run(() => onConfirm(taskId, message))}
      />
    </>
  );
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
  return (
    <ActionDialog open={open} title="催办" onClose={onClose}>
      <UrgeForm targets={targets} onClose={onClose} onConfirm={onConfirm} />
    </ActionDialog>
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

function ReasonForm({
  okText,
  danger,
  placeholder,
  onClose,
  onConfirm
}: Omit<ReasonModalProps, "open" | "title">) {
  const [reason, setReason] = useState("");
  const { submitting, run } = useConfirm(onClose);

  return (
    <>
      <Stack gap={4} style={{ paddingBlock: 8 }}>
        <Input.TextArea
          maxLength={2000}
          placeholder={placeholder ?? "请输入原因（可选）"}
          rows={3}
          value={reason}
          onChange={event => setReason(event.target.value)}
        />
      </Stack>

      <ActionFooter
        danger={danger}
        okText={okText}
        submitting={submitting}
        onCancel={onClose}
        onOk={() => void run(() => onConfirm(reason))}
      />
    </>
  );
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
  return (
    <ActionDialog open={open} title={title} onClose={onClose}>
      <ReasonForm danger={danger} okText={okText} placeholder={placeholder} onClose={onClose} onConfirm={onConfirm} />
    </ActionDialog>
  );
}
