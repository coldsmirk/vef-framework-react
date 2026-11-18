import type { Ref } from "react";

import type { BusinessFormHandle, BusinessKindRenderer } from "../../plugins";
import type { VoidRecord, VoidRequestBusinessView, VoidTarget } from "../../types";

import { Alert, Stack } from "@vef-framework-react/components";
import { useEffect, useImperativeHandle } from "react";

import { isMyInstanceDetail } from "../../types";
import { useVoidDraft, VoidFormFields } from "./form";
import { PlanSummary, TargetSummary, VoidRecordSummary } from "./summary";

function RequestForm({
  target,
  record,
  handle,
  onAvailabilityChange
}: {
  target: VoidTarget;
  record?: VoidRecord;
  handle: Ref<BusinessFormHandle>;
  onAvailabilityChange?: (available: boolean) => void;
}) {
  const draft = useVoidDraft(target, "requester", record);
  useEffect(() => {
    onAvailabilityChange?.(!draft.issue);
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
    if (!voidTarget) {
      onAvailabilityChange?.(false);
    }
  }, [voidTarget, onAvailabilityChange]);
  return voidTarget
    ? <RequestForm handle={handle} target={voidTarget} onAvailabilityChange={onAvailabilityChange} />
    : <Alert showIcon title="请从需要作废的审批单详情申请作废" type="info" />;
};

export const VoidRequestDetailView: BusinessKindRenderer["DetailView"] = ({
  detail,
  view,
  handle
}) => {
  const data = view as VoidRequestBusinessView | null;
  const editable = isMyInstanceDetail(detail) && detail.availableActions.includes("resubmit");
  // A review decision carries no business edits. A returned request installs its editable handle below.
  useImperativeHandle(editable ? null : handle, () => {
    return { collect: () => Promise.resolve({}) };
  }, []);

  if (!data) {
    return <Alert showIcon title="无法读取作废申请详情" type="warning" />;
  }

  return editable
    ? <RequestForm key={data.record.id} handle={handle} record={data.record} target={data.target} />
    : (
        <Stack gap={16}>
          <TargetSummary target={data.target} />
          <PlanSummary plan={data.plan} />
          <VoidRecordSummary record={data.record} />
        </Stack>
      );
};
