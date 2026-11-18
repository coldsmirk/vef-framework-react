import type { ReactNode } from "react";

import type { VoidPlan, VoidRecord, VoidRequestSummary, VoidTarget } from "../../types";

import { Alert, Button, Drawer, Flex, Stack, StoredFileUpload, Text } from "@vef-framework-react/components";
import { useState } from "react";

import { formatTimestamp } from "../format";

function Items({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <Text strong>{title}</Text>
      <ul style={{ marginBlock: 4, paddingInlineStart: 20 }}>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </div>
  );
}

export function PlanSummary({ plan }: { plan: VoidPlan }) {
  return (
    <Stack gap={8}>
      {plan.blockers.length > 0 && <Alert showIcon description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{plan.blockers.map((item, index) => <li key={index}>{item}</li>)}</ul>} title="目前无法作废" type="warning" />}
      <Items items={plan.reversals} title="将撤销的事项" />
      <Items items={plan.followUps} title="需要人工跟进" />
      {plan.blockers.length === 0 && plan.reversals.length === 0 && plan.followUps.length === 0 && <Text type="secondary">本次作废没有需撤销或跟进的事项。</Text>}
    </Stack>
  );
}

export function TargetSummary({ target }: { target: VoidTarget }) {
  return (
    <Stack gap={4}>
      {target.title && <Text strong>{target.title}</Text>}

      <Flex gap="small" wrap="wrap">
        {target.instanceNo && <Text>{target.instanceNo}</Text>}
        {target.flowName && <Text>{target.flowName}</Text>}
        {target.applicant && <Text>{`申请人 ${target.applicant.name}`}</Text>}
        {target.applicant?.departmentName && <Text>{target.applicant.departmentName}</Text>}
        {target.finishedAt && <Text>{`完成于 ${formatTimestamp(target.finishedAt)}`}</Text>}
      </Flex>
    </Stack>
  );
}

const recordLabels = {
  requested: "作废申请中",
  dismissed: "作废申请已结束",
  voided: "已作废"
};

export function VoidRecordSummary({ record }: { record: VoidRecord }) {
  return (
    <Stack gap={8}>
      <Flex gap="small" wrap="wrap">
        <Text strong>{recordLabels[record.status]}</Text>
        <Text>{`${record.status === "voided" ? "作废人" : "申请人"} ${record.operator.name}`}</Text>
        {record.voidedAt && <Text>{formatTimestamp(record.voidedAt)}</Text>}
      </Flex>

      {record.reason !== undefined && <Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{`作废原因：${record.reason}`}</Text>}
      {!!record.attachments?.length && <StoredFileUpload disabled maxCount={record.attachments.length} value={record.attachments} onChange={() => undefined} />}

      {record.status === "voided" && (
        <>
          <Items items={record.reversals} title="已撤销的事项" />
          <Items items={record.followUps} title="需要人工跟进" />
        </>
      )}
    </Stack>
  );
}

export function VoidBanners({
  record,
  request,
  renderRequest
}: {
  record?: VoidRecord;
  request?: VoidRequestSummary;
  renderRequest: (id: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {record && <Alert title={<VoidRecordSummary record={record} />} type="info" />}

      {request && (
        <>
          <Alert
            title={request.requestStatus === "returned" ? "作废申请已退回修改" : "作废申请审批中"}
            type="info"
            description={(
              <Flex align="baseline" gap="small" wrap="wrap">
                <Text>{`${request.applicant.name} · ${formatTimestamp(request.createdAt)}`}</Text>
                <Button type="link" onClick={() => setOpen(true)}>{`查看作废申请 ${request.requestInstanceNo}`}</Button>
              </Flex>
            )}
          />

          <Drawer destroyOnHidden open={open} size={880} title="作废申请详情" onClose={() => setOpen(false)}>
            {open && renderRequest(request.requestInstanceId)}
          </Drawer>
        </>
      )}
    </>
  );
}
