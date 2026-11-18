import type { BusinessFormHandle, BusinessKindRenderer } from "@vef-framework-react/approval";
import type { Ref } from "react";

import { isMyInstanceDetail } from "@vef-framework-react/approval";
import { Checkbox, Input, Labeled, Stack, Text } from "@vef-framework-react/components";
import { useImperativeHandle, useState } from "react";

interface Meeting { id: string; room: string; agenda: string; subject: string; writes: number }

const blank: Meeting = {
  id: "",
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

export const meetingRenderer: BusinessKindRenderer = {
  VoidOptions: ({ value, onChange }) => <Checkbox checked={value.releaseRoom === true} onChange={event => onChange({ releaseRoom: event.target.checked })}>同时释放会议室时段</Checkbox>,
  StartForm: ({ handle }) => <MeetingForm writable handle={handle} value={blank} />,
  DetailView: ({
    detail,
    view,
    handle,
    myTask
  }) => {
    const meeting = view as Meeting;
    return <MeetingForm key={meeting.id} handle={handle} value={meeting} writable={Boolean(myTask || (isMyInstanceDetail(detail) && detail.availableActions.includes("resubmit")))} />;
  }
};
