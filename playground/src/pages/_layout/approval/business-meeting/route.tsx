import type { BusinessFormHandle, BusinessKindRenderer } from "@vef-framework-react/approval";
import type { Ref } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalProvider, InstanceDetailPanel, StartInstanceDrawer, useApprovalPlugins, useMyApprovalApi } from "@vef-framework-react/approval";
import { Button, Card, Flex, Input, Labeled, Segmented, Stack, Text } from "@vef-framework-react/components";
import { useQueryClient } from "@vef-framework-react/core";
import { useImperativeHandle, useState } from "react";

interface Meeting { room: string; agenda: string; subject: string; writes: number }

const blank: Meeting = {
  room: "三楼 · 松林会议室",
  agenda: "",
  subject: "",
  writes: 0
};

function MeetingForm({
  handle,
  value,
  writable
}: { handle: Ref<BusinessFormHandle>; value: Meeting; writable: boolean }) {
  const [form, setForm] = useState(value);
  useImperativeHandle(handle, () => {
    return {
      collect() {
        if (!form.subject.trim() || !form.room.trim()) {
          return Promise.reject(new Error("请填写会议主题和会议室"));
        }

        return Promise.resolve({
          subject: form.subject,
          room: form.room,
          agenda: form.agenda
        });
      }
    };
  }, [form]);

  return (
    <Stack gap={12}>
      <Labeled label="会议主题"><Input aria-label="会议主题" readOnly={!writable} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></Labeled>
      <Labeled label="会议室"><Input aria-label="会议室" readOnly={!writable} value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} /></Labeled>
      <Labeled label="会议议程"><Input.TextArea aria-label="会议议程" readOnly={!writable} rows={3} value={form.agenda} onChange={e => setForm({ ...form, agenda: e.target.value })} /></Labeled>
      {value.writes > 0 && <Text type="secondary">{`本单已收到 ${value.writes} 次审批提交`}</Text>}
    </Stack>
  );
}

const renderer: BusinessKindRenderer = {
  StartForm: ({ handle }) => <MeetingForm writable handle={handle} value={blank} />,
  DetailView: ({
    detail,
    view,
    handle,
    myTask
  }) => <MeetingForm handle={handle} value={view as Meeting} writable={Boolean(myTask || ("availableActions" in detail && detail.availableActions.includes("resubmit")))} />
};

function MeetingPage() {
  const host = useApprovalPlugins();
  const { getInstanceDetail } = useMyApprovalApi();
  const client = useQueryClient();
  const [instance, setInstance] = useState("meeting-review");
  const [started, setStarted] = useState(false);
  const [open, setOpen] = useState(false);
  const options = [{ label: "待我审核", value: "meeting-review" }, { label: "退回待修改", value: "meeting-returned" }];

  if (started) {
    options.push({ label: "新发起的预订", value: "meeting-new" });
  }

  return (
    <ApprovalProvider plugins={{ ...host, businessKinds: { ...host.businessKinds, "office.meeting": renderer } }}>
      <Card extra={<Button type="primary" onClick={() => setOpen(true)}>发起会议预订</Button>} title="会议室预订">
        <Flex vertical gap="middle">
          <Segmented options={options} style={{ alignSelf: "flex-start" }} value={instance} onChange={setInstance} />
          <InstanceDetailPanel key={instance} instanceId={instance} />
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
    </ApprovalProvider>
  );
}

export const Route = createFileRoute("/_layout/approval/business-meeting")({ component: MeetingPage });
