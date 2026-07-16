import type { DescriptionsItem } from "@vef-framework-react/components";
import type { FormRendererApi } from "@vef-framework-react/form-editor";
import type { ReactNode } from "react";

import type { InstanceAction, MyInstanceDetail, ProcessTaskAction, UserInfo } from "../../types";
import type { UrgeTarget } from "./action-modals";

import {
  Button,
  Descriptions,
  Empty,
  Flex,
  globalCssVars,
  Icon,
  Input,
  showSuccessMessage,
  showWarningMessage,
  Space,
  Spin,
  Stack,
  Tabs,
  Text,
  Title
} from "@vef-framework-react/components";
import { useMutation, useQuery } from "@vef-framework-react/core";
import {
  CheckIcon,
  CornerUpLeftIcon,
  MailPlusIcon,
  MegaphoneIcon,
  RotateCcwIcon,
  SendIcon,
  Undo2Icon,
  UserPlusIcon,
  XIcon
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useInstanceApi, useMyApprovalApi } from "../../api";
import { useApprovalPlugins } from "../../plugins";
import { InstanceFlowGraphViewer } from "../flow-graph";
import { InstanceFormPanel } from "../form-panel";
import { formatTimestamp } from "../format";
import { LabelsDisplay } from "../labels";
import { InstanceStatusTag } from "../status";
import { InstanceTimeline } from "../timeline";
import { UserLabel } from "../user";
import { AddAssigneeModal, CCModal, ReasonModal, RollbackModal, TransferModal, UrgeModal } from "./action-modals";

export type { UrgeTarget } from "./action-modals";

/**
 * The shared instance header: title + status, then the identity fields as
 * one descriptions block. `labels` renders the flow's host-owned selection
 * metadata — pass it on operator-facing views (the admin detail) and omit it
 * on applicant-facing ones, where the tags would read as noise.
 */
export function InstanceHeader({
  title,
  status,
  instanceNo,
  flowName,
  applicant,
  createdAt,
  finishedAt,
  currentNodeName,
  businessRef,
  labels
}: {
  title: string;
  status: MyInstanceDetail["instance"]["status"];
  instanceNo: string;
  flowName: string;
  applicant: UserInfo;
  createdAt: string;
  finishedAt?: string;
  currentNodeName?: string;
  businessRef?: string;
  labels?: Record<string, string>;
}) {
  const { renderBusinessRef } = useApprovalPlugins();

  const items: DescriptionsItem[] = [
    {
      key: "no",
      label: "审批单号",
      children: <Text copyable>{instanceNo}</Text>
    },
    {
      key: "flow",
      label: "所属流程",
      children: flowName
    },
    {
      key: "applicant",
      label: "申请人",
      children: <UserLabel user={applicant} />
    },
    {
      key: "created",
      label: "提交时间",
      children: formatTimestamp(createdAt)
    }
  ];

  if (currentNodeName !== undefined) {
    items.push({
      key: "node",
      label: "当前节点",
      children: currentNodeName
    });
  }

  if (finishedAt !== undefined) {
    items.push({
      key: "finished",
      label: "完成时间",
      children: formatTimestamp(finishedAt)
    });
  }

  if (businessRef !== undefined && businessRef !== "") {
    items.push({
      key: "businessRef",
      label: "业务单据",
      children: renderBusinessRef ? renderBusinessRef(businessRef) : <Text code>{businessRef}</Text>
    });
  }

  if (labels !== undefined && Object.keys(labels).length > 0) {
    items.push({
      key: "labels",
      label: "流程标签",
      children: <LabelsDisplay labels={labels} />
    });
  }

  return (
    <Stack gap={12}>
      <Flex align="center" gap="middle" wrap="wrap">
        <Title level={4} style={{ margin: 0 }}>{title}</Title>
        <InstanceStatusTag status={status} />
      </Flex>

      <Descriptions
        colon
        items={items}
        size="small"
        column={{
          xs: 1,
          sm: 2,
          lg: 3
        }}
      />
    </Stack>
  );
}

type DetailModal = "transfer" | "rollback" | "addAssignee" | "cc" | "urge" | "withdraw";

/**
 * The form-tab submission modes routed through the form renderer's validate +
 * submit pipeline.
 */
type FormSubmitMode = "approve" | "handle" | "resubmit";

export interface InstanceDetailPanelProps {
  instanceId: string;
  /**
   * Fired after any successful action so the surrounding list can refetch;
   * the panel refetches its own detail automatically.
   */
  onActionCompleted?: () => void;
}

/**
 * The self-service instance detail: header, the version-pinned form clamped
 * by the viewer's field permissions, the transit timeline, and the progress
 * flow graph — with the action bar derived entirely from the server-resolved
 * `availableActions` / `myTask` context, so the offered set can never drift
 * from what the engine accepts.
 */
export function InstanceDetailPanel({ instanceId, onActionCompleted }: InstanceDetailPanelProps) {
  const api = useMyApprovalApi();
  const instanceApi = useInstanceApi();

  const {
    data: detail,
    isLoading,
    refetch
  } = useQuery({
    queryFn: api.getInstanceDetail,
    queryKey: [api.getInstanceDetail.key, { instanceId }]
  });

  // The panel shows its own action-specific success messages, so the generic
  // backend feedback is suppressed on every action mutation.
  const suppressFeedback = { meta: { shouldShowSuccessFeedback: false } } as const;
  const processTask = useMutation({ mutationFn: instanceApi.processTask, ...suppressFeedback });
  const resubmit = useMutation({ mutationFn: instanceApi.resubmit, ...suppressFeedback });
  const withdraw = useMutation({ mutationFn: instanceApi.withdraw, ...suppressFeedback });
  const addAssignee = useMutation({ mutationFn: instanceApi.addAssignee, ...suppressFeedback });
  const addCC = useMutation({ mutationFn: instanceApi.addCC, ...suppressFeedback });
  const urgeTask = useMutation({ mutationFn: instanceApi.urgeTask, ...suppressFeedback });

  const [modal, setModal] = useState<DetailModal | null>(null);
  const [opinion, setOpinion] = useState("");
  const [acting, setActing] = useState(false);
  const formApiRef = useRef<FormRendererApi | null>(null);
  const submitModeRef = useRef<FormSubmitMode | null>(null);

  const actions = useMemo(() => new Set<InstanceAction>(detail?.availableActions), [detail]);
  const myTask = detail?.myTask;

  const urgeTargets = useMemo<UrgeTarget[]>(
    () => {
      const targets: UrgeTarget[] = [];
      const timeline = detail?.timeline ?? [];

      for (const entry of timeline) {
        if (entry.kind !== "approval" && entry.kind !== "handle") {
          continue;
        }

        const participants = entry.participants ?? [];

        for (const participant of participants) {
          if (participant.status === "pending") {
            targets.push({
              taskId: participant.taskId,
              assigneeName: participant.user.name || participant.user.id,
              nodeName: entry.name ?? ""
            });
          }
        }
      }

      return targets;
    },
    [detail]
  );

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
  const decisionAction: Extract<ProcessTaskAction, "approve" | "handle"> | null
    = actions.has("handle") ? "handle" : actions.has("approve") ? "approve" : null;
  const canDecide = decisionAction !== null && myTask !== undefined;
  const canResubmit = actions.has("resubmit");
  const formWritable = canDecide || canResubmit;

  async function completeAction(message: string): Promise<void> {
    showSuccessMessage(message);
    setOpinion("");
    await refetch();
    onActionCompleted?.();
  }

  async function runAction(action: () => Promise<unknown>, message: string): Promise<void> {
    setActing(true);

    try {
      await action();
      await completeAction(message);
    } catch {
      /* surfaced by the http client */
    } finally {
      setActing(false);
    }
  }

  function requireOpinion(): boolean {
    if (myTask?.isOpinionRequired && opinion.trim() === "") {
      showWarningMessage("该节点要求填写审批意见");

      return false;
    }

    return true;
  }

  /**
   * Route approve / handle / resubmit through the renderer's validation +
   * submit pipeline: a failed required check blocks inline and `onFormSubmit`
   * never fires. Flows without a form dispatch directly.
   */
  async function submitViaForm(mode: FormSubmitMode): Promise<void> {
    if (mode !== "resubmit" && !requireOpinion()) {
      return;
    }

    if (!detail?.formSchema) {
      await dispatchFormSubmit(mode, undefined);

      return;
    }

    submitModeRef.current = mode;

    try {
      await formApiRef.current?.submit();
    } finally {
      submitModeRef.current = null;
    }
  }

  function onFormSubmit(values: Record<string, unknown>): void {
    const mode = submitModeRef.current;

    if (mode === null) {
      return;
    }

    void dispatchFormSubmit(mode, values);
  }

  async function dispatchFormSubmit(mode: FormSubmitMode, values: Record<string, unknown> | undefined): Promise<void> {
    if (mode === "resubmit") {
      await runAction(
        () => resubmit.mutateAsync({ instanceId, formData: values }),
        "已重新提交"
      );

      return;
    }

    if (myTask === undefined) {
      return;
    }

    await runAction(
      () => processTask.mutateAsync({
        taskId: myTask.taskId,
        action: mode,
        opinion: opinion.trim() || undefined,
        formData: values
      }),
      mode === "handle" ? "已办理" : "已通过"
    );
  }

  async function rejectTask(): Promise<void> {
    if (myTask === undefined || !requireOpinion()) {
      return;
    }

    // Reject bypasses the required-field validation deliberately — the
    // backend never blocks a reject on required fields. The writable subset
    // still rides along.
    const values = formApiRef.current?.getSubmitValues();

    await runAction(
      () => processTask.mutateAsync({
        taskId: myTask.taskId,
        action: "reject",
        opinion: opinion.trim() || undefined,
        formData: values
      }),
      "已拒绝"
    );
  }

  const secondaryButtons: ReactNode[] = [];

  if (actions.has("transfer") && myTask !== undefined) {
    secondaryButtons.push(
      <Button key="transfer" icon={<Icon component={CornerUpLeftIcon} />} onClick={() => setModal("transfer")}>
        转办
      </Button>
    );
  }

  if (actions.has("rollback") && (myTask?.rollbackTargets?.length ?? 0) > 0) {
    secondaryButtons.push(
      <Button key="rollback" icon={<Icon component={Undo2Icon} />} onClick={() => setModal("rollback")}>
        回退
      </Button>
    );
  }

  if (actions.has("add_assignee") && (myTask?.addAssigneeTypes?.length ?? 0) > 0) {
    secondaryButtons.push(
      <Button key="addAssignee" icon={<Icon component={UserPlusIcon} />} onClick={() => setModal("addAssignee")}>
        加签
      </Button>
    );
  }

  if (actions.has("add_cc")) {
    secondaryButtons.push(
      <Button key="cc" icon={<Icon component={MailPlusIcon} />} onClick={() => setModal("cc")}>
        抄送
      </Button>
    );
  }

  if (actions.has("urge") && urgeTargets.length > 0) {
    secondaryButtons.push(
      <Button key="urge" icon={<Icon component={MegaphoneIcon} />} onClick={() => setModal("urge")}>
        催办
      </Button>
    );
  }

  if (actions.has("withdraw")) {
    secondaryButtons.push(
      <Button key="withdraw" icon={<Icon component={RotateCcwIcon} />} onClick={() => setModal("withdraw")}>
        撤回
      </Button>
    );
  }

  const showActionArea = canDecide || canResubmit || secondaryButtons.length > 0;

  const formTab = (
    <Stack gap={16}>
      <InstanceFormPanel
        apiRef={formApiRef}
        disabled={!formWritable}
        fieldPermissions={detail.fieldPermissions}
        formData={instance.formData}
        schema={detail.formSchema}
        onSubmit={onFormSubmit}
      />

      {showActionArea && (
        <Stack
          gap={12}
          style={{
            borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`,
            paddingTop: 16
          }}
        >
          {canDecide && (
            <Stack gap={4}>
              <Text strong>
                审批意见
                {myTask?.isOpinionRequired ? <Text type="danger">（必填）</Text> : null}
              </Text>

              <Input.TextArea
                maxLength={2000}
                placeholder="请输入审批意见"
                rows={3}
                value={opinion}
                onChange={event => setOpinion(event.target.value)}
              />
            </Stack>
          )}

          <Flex align="center" gap="small" wrap="wrap">
            {canDecide && (
              <>
                <Button
                  icon={<Icon component={CheckIcon} />}
                  loading={acting}
                  type="primary"
                  onClick={() => void submitViaForm(decisionAction)}
                >
                  {decisionAction === "handle" ? "办理" : "通过"}
                </Button>

                <Button
                  danger
                  icon={<Icon component={XIcon} />}
                  loading={acting}
                  onClick={() => void rejectTask()}
                >
                  拒绝
                </Button>
              </>
            )}

            {canResubmit && (
              <Button
                icon={<Icon component={SendIcon} />}
                loading={acting}
                type="primary"
                onClick={() => void submitViaForm("resubmit")}
              >
                重新提交
              </Button>
            )}

            <Space wrap size={8}>{secondaryButtons}</Space>
          </Flex>
        </Stack>
      )}
    </Stack>
  );

  return (
    <Stack gap={20}>
      <InstanceHeader
        applicant={instance.applicant}
        businessRef={instance.businessRef}
        createdAt={instance.createdAt}
        currentNodeName={instance.currentNodeName}
        finishedAt={instance.finishedAt}
        flowName={instance.flowName}
        instanceNo={instance.instanceNo}
        status={instance.status}
        title={instance.title}
      />

      <Tabs
        items={[
          {
            key: "form",
            label: "审批表单",
            children: formTab
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
          }
        ]}
      />

      <TransferModal
        open={modal === "transfer"}
        onClose={() => setModal(null)}
        onConfirm={async (transferToId, transferOpinion) => {
          if (myTask === undefined) {
            return;
          }

          await processTask.mutateAsync({
            taskId: myTask.taskId,
            action: "transfer",
            transferToId,
            opinion: transferOpinion.trim() || undefined
          });
          await completeAction("已转办");
        }}
      />

      <RollbackModal
        open={modal === "rollback"}
        targets={myTask?.rollbackTargets ?? []}
        onClose={() => setModal(null)}
        onConfirm={async (targetNodeId, rollbackOpinion) => {
          if (myTask === undefined) {
            return;
          }

          await processTask.mutateAsync({
            taskId: myTask.taskId,
            action: "rollback",
            targetNodeId,
            opinion: rollbackOpinion.trim() || undefined
          });
          await completeAction("已回退");
        }}
      />

      <AddAssigneeModal
        allowedTypes={myTask?.addAssigneeTypes ?? []}
        open={modal === "addAssignee"}
        onClose={() => setModal(null)}
        onConfirm={async (userIds, addType) => {
          if (myTask === undefined) {
            return;
          }

          await addAssignee.mutateAsync({
            taskId: myTask.taskId,
            userIds,
            addType
          });
          await completeAction("已加签");
        }}
      />

      <CCModal
        open={modal === "cc"}
        onClose={() => setModal(null)}
        onConfirm={async ccUserIds => {
          await addCC.mutateAsync({ instanceId, ccUserIds });
          await completeAction("已抄送");
        }}
      />

      <UrgeModal
        open={modal === "urge"}
        targets={urgeTargets}
        onClose={() => setModal(null)}
        onConfirm={async (taskId, message) => {
          await urgeTask.mutateAsync({ taskId, message: message.trim() || undefined });
          await completeAction("已催办");
        }}
      />

      <ReasonModal
        okText="撤回"
        open={modal === "withdraw"}
        placeholder="请输入撤回原因（可选）"
        title="撤回审批单"
        onClose={() => setModal(null)}
        onConfirm={async reason => {
          await withdraw.mutateAsync({ instanceId, reason: reason.trim() || undefined });
          await completeAction("已撤回");
        }}
      />
    </Stack>
  );
}
