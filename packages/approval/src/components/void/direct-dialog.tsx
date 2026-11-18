import type { VoidTarget } from "../../types";

import { Alert, showSuccessMessage, Stack } from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { useState } from "react";

import { useAdminApprovalApi, useMyApprovalApi } from "../../api";
import { ActionDialog, ActionFooter, useConfirm } from "../action-dialog";
import { useVoidDraft, VoidFormFields } from "./form";
import { TargetSummary } from "./summary";

function DirectVoidForm({ target, onClose }: { target: VoidTarget & { instanceId: string }; onClose: () => void }) {
  const draft = useVoidDraft(target, "admin");
  const admin = useAdminApprovalApi();
  const my = useMyApprovalApi();
  const [error, setError] = useState("");
  const action = useMutation({
    mutationFn: admin.voidInstance,
    meta: {
      shouldShowSuccessFeedback: false,
      invalidates: [
        [admin.getInstanceDetail.key, { instanceId: target.instanceId }],
        [my.getInstanceDetail.key, { instanceId: target.instanceId }],
        [admin.findInstances.key],
        [admin.findActionLogs.key],
        [admin.findBusinessProjections.key],
        [admin.getMetrics.key],
        [my.findInitiated.key],
        [my.findCompletedTasks.key]
      ]
    }

  });
  const confirm = useConfirm(onClose, e => {
    setError(e instanceof Error ? e.message : "作废失败，请重试");
    void draft.preview.refetch();
  });
  return (
    <>
      <Stack
        gap={16}
        style={{
          maxHeight: "max(15dvh, calc(100dvh - 200px))",
          overflowY: "auto",
          paddingInlineEnd: 4
        }}
      >
        <TargetSummary target={target} />
        <VoidFormFields draft={draft} target={target} />
        {error && <Alert showIcon title={error} type="error" />}
      </Stack>

      <ActionFooter
        danger
        disabled={Boolean(draft.issue)}
        okText="确认作废"
        submitting={confirm.submitting}
        onCancel={onClose}
        onOk={() => void confirm.run(async () => {
          await action.mutateAsync({
            instanceId: target.instanceId,
            reason: draft.reason.trim(),
            attachments: draft.attachments,
            options: draft.options
          });
          showSuccessMessage("审批单已作废");
        })}
      />
    </>
  );
}

export function DirectVoidDialog({
  open,
  target,
  onClose
}: { open: boolean; target: VoidTarget & { instanceId: string }; onClose: () => void }) {
  return (
    <ActionDialog open={open} title="作废审批单" onClose={onClose}>
      <DirectVoidForm target={target} onClose={onClose} />
    </ActionDialog>
  );
}
