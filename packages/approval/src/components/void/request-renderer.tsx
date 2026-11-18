import type { Ref } from "react";

import type { BusinessFormHandle, BusinessKindRenderer } from "../../plugins";
import type { VoidRecord, VoidRequestBusinessView, VoidTarget } from "../../types";

import { Alert, Button, Drawer, Stack } from "@vef-framework-react/components";
import { useEffect, useImperativeHandle, useState } from "react";

import { isMyInstanceDetail } from "../../types";
import { InstanceDetailPanel } from "../detail";
import { AdminInstanceDetailPanel } from "../detail/admin";
import { useVoidDraft, VoidFormFields } from "./form";
import { PlanSummary, TargetSummary, VoidRecordSummary } from "./summary";

function RequestForm({
  target,
  record,
  handle,
  onAvailabilityChange
}: {
  target: VoidTarget & { instanceId: string };
  record?: VoidRecord;
  handle: Ref<BusinessFormHandle>;
  onAvailabilityChange?: (available: boolean, reason?: string) => void;
}) {
  const draft = useVoidDraft(target, "requester", record);
  useEffect(() => {
    onAvailabilityChange?.(!draft.issue, draft.issue);
  }, [draft.issue, onAvailabilityChange]);
  useImperativeHandle(handle, () => {
    return {
      collect() {
        if (draft.issue) {
          return Promise.reject(new Error(draft.issue));
        }

        return Promise.resolve({
          targetInstanceId: target.instanceId,
          reason: draft.reason.trim(),
          attachments: draft.attachments,
          options: draft.options
        });
      }
    };
  }, [draft, target.instanceId]);
  return (
    <Stack gap={16}>
      <TargetSummary target={target} />
      <VoidFormFields draft={draft} target={target} />
    </Stack>
  );
}

export const VoidRequestStartForm: BusinessKindRenderer["StartForm"] = ({
  voidTarget,
  handle,
  onAvailabilityChange
}) => {
  useEffect(() => {
    if (!voidTarget?.instanceId) {
      onAvailabilityChange?.(false, "请从需要作废的审批单详情申请作废");
    }
  }, [voidTarget, onAvailabilityChange]);
  return voidTarget?.instanceId
    ? <RequestForm handle={handle} target={{ ...voidTarget, instanceId: voidTarget.instanceId }} onAvailabilityChange={onAvailabilityChange} />
    : <Alert showIcon title="请从需要作废的审批单详情申请作废" type="info" />;
};

export const VoidRequestDetailView: BusinessKindRenderer["DetailView"] = ({
  detail,
  view,
  handle,
  onAvailabilityChange
}) => {
  const data = view as VoidRequestBusinessView | null;
  const [openTarget, setOpenTarget] = useState(false);
  const canResubmit = isMyInstanceDetail(detail) && detail.availableActions.includes("resubmit");
  const targetId = data?.target.instanceId;
  const editable = canResubmit && Boolean(targetId) && data?.record.reason !== undefined;
  useEffect(() => {
    if (canResubmit && !editable) {
      onAvailabilityChange?.(false, "当前可见信息不足，无法重新提交作废申请");
    }
  }, [editable, canResubmit, onAvailabilityChange]);
  // A review decision carries no business edits. A returned request installs its editable handle below.
  useImperativeHandle(editable ? null : handle, () => {
    return { collect: () => canResubmit ? Promise.reject(new Error("当前可见信息不足，无法重新提交作废申请")) : Promise.resolve({}) };
  }, [canResubmit]);

  if (!data) {
    return <Alert showIcon title="无法读取作废申请详情" type="warning" />;
  }

  return editable && targetId
    ? <RequestForm key={data.record.id} handle={handle} record={data.record} target={{ ...data.target, instanceId: targetId }} onAvailabilityChange={onAvailabilityChange} />
    : (
        <Stack gap={16}>
          <TargetSummary target={data.target} />

          {targetId && (
            <>
              <Button style={{ alignSelf: "flex-start" }} type="link" onClick={() => setOpenTarget(true)}>查看原审批单</Button>

              <Drawer destroyOnHidden open={openTarget} size={880} title="原审批单" onClose={() => setOpenTarget(false)}>
                {openTarget && (isMyInstanceDetail(detail) ? <InstanceDetailPanel instanceId={targetId} /> : <AdminInstanceDetailPanel instanceId={targetId} />)}
              </Drawer>
            </>
          )}

          {canResubmit && !editable && <Alert showIcon title="当前可见信息不足，无法重新提交作废申请" type="warning" />}
          {data.record.status === "requested" && <PlanSummary plan={data.plan} />}
          <VoidRecordSummary record={data.record} />
        </Stack>
      );
};
