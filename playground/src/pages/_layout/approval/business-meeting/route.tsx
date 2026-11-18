import { createFileRoute } from "@tanstack/react-router";
import { AdminInstanceDetailPanel, InstanceDetailPanel, StartInstanceDrawer, useMyApprovalApi } from "@vef-framework-react/approval";
import { Button, Card, Flex, Labeled, Page, Select } from "@vef-framework-react/components";
import { useQueryClient } from "@vef-framework-react/core";
import { useState } from "react";

function MeetingPage() {
  const { getInstanceDetail } = useMyApprovalApi();
  const client = useQueryClient();
  const [instance, setInstance] = useState("meeting-review");
  const [started, setStarted] = useState(false);
  const [open, setOpen] = useState(false);
  const options = [
    { label: "待我审核", value: "meeting-review" },
    { label: "退回待修改", value: "meeting-returned" },
    { label: "直接作废", value: "meeting-direct" },
    { label: "作废被阻止", value: "meeting-blocked" },
    { label: "申请作废", value: "meeting-requestable" },
    { label: "作废申请审批中", value: "meeting-pending" },
    { label: "作废申请已退回", value: "meeting-revision" },
    { label: "已作废", value: "meeting-voided" },
    { label: "作废申请已获批", value: "meeting-delivery-request" },
    { label: "作废申请已结束", value: "meeting-premises-request" },
    { label: "费用报销 · 字段批注与交接", value: "expense-review" },
    { label: "费用报销 · 表格明细批注", value: "expense-table" },
    { label: "资产调拨 · 未注册业务表单", value: "asset-returned" }
  ];

  if (started) {
    options.push({ label: "新发起的预订", value: "meeting-new" });
  }

  return (
    <Page margin scrollable>
      <Card extra={<Button type="primary" onClick={() => setOpen(true)}>发起会议预订</Button>} title="审批场景演示">
        <Flex vertical gap="middle">
          <Labeled label="演示场景">
            <Select
              aria-label="演示场景"
              options={options}
              showSearch={{ optionFilterProp: "label" }}
              style={{ width: 240, maxWidth: "100%" }}
              value={instance}
              onChange={setInstance}
            />
          </Labeled>

          {instance === "meeting-direct" || instance === "meeting-blocked" ? <AdminInstanceDetailPanel key={instance} instanceId={instance} /> : <InstanceDetailPanel key={instance} instanceId={instance} />}
        </Flex>

        <StartInstanceDrawer
          flowCode={open ? "meeting" : null}
          onClose={() => setOpen(false)}
          onStarted={() => {
            void client.invalidateQueries({ queryKey: [getInstanceDetail.key, { instanceId: "meeting-new" }] });
            setStarted(true);
            setInstance("meeting-new");
          }}
        />
      </Card>
    </Page>
  );
}

export const Route = createFileRoute("/_layout/approval/business-meeting")({ component: MeetingPage });
