import type { AnnotationView, FieldAnchor, InstanceDetail } from "../../types";
import type { AnnotationGroup, AnnotationThread } from "./use-annotations";

import { Button, Empty, Flex, globalCssVars, Modal, Stack, Text } from "@vef-framework-react/components";
import { useMemo, useState } from "react";

import { InstanceTimeline } from "../timeline";
import { AnnotationComposer, AnnotationResponseComposer } from "./composers";
import { matchesField, useAnnotations } from "./use-annotations";

export { AnnotationComposer, AnnotationResponseComposer } from "./composers";
export { useAnnotations } from "./use-annotations";
export type { AnnotationGroup, AnnotationThread } from "./use-annotations";

const statuses = {
  draft: "草稿",
  published: "已发布",
  discarded: "已作废（待办已由他人处理）"
};
const audiences = {
  participants: "所有参与人可见",
  applicant: "仅申请人可见",
  nodes: "指定节点可见",
  users: "指定人员可见"
};

function AnnotationLine({ value }: { value: AnnotationView }) {
  return (
    <Stack gap={4}>
      <Flex align="baseline" gap="small" wrap="wrap">
        <Text strong>{value.author.name}</Text>
        <Text type="secondary">{value.status === "discarded" && value.parentId ? "已作废（审批单已结束）" : statuses[value.status]}</Text>
        {value.resolution && <Text>{value.resolution === "addressed" ? "已修改" : "不采纳"}</Text>}
        <Text type="secondary">{audiences[value.audience.scope]}</Text>
      </Flex>

      {value.content && <Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value.content}</Text>}
    </Stack>
  );
}

function Thread({
  detail,
  thread,
  taskId,
  canRespond
}: {
  detail: InstanceDetail;
  thread: AnnotationThread;
  taskId?: string;
  canRespond: boolean;
}) {
  const { annotation, responses } = thread;
  const [editing, setEditing] = useState(false);
  const draftResponse = responses.find(r => r.status === "draft");
  const respond = canRespond && annotation.status === "published" && !annotation.parentId;
  const edit = Boolean(taskId && annotation.taskId === taskId && annotation.status === "draft");
  return (
    <Stack gap={8} style={{ borderInlineStart: `2px solid ${globalCssVars.colorBorderSecondary}`, paddingInlineStart: 12 }}>
      <AnnotationLine value={annotation} />
      {responses.map(response => <div key={response.id} style={{ paddingInlineStart: 12 }}><AnnotationLine value={response} /></div>)}

      {editing
        ? (
            <>
              {edit
                ? <AnnotationComposer detail={detail} draft={annotation} onDone={() => setEditing(false)} />
                : <AnnotationResponseComposer detail={detail} draft={draftResponse} parent={annotation} onDone={() => setEditing(false)} />}

              <Button size="small" style={{ alignSelf: "flex-start" }} type="text" onClick={() => setEditing(false)}>取消</Button>
            </>
          )
        : (edit || respond) && (
            <Button size="small" style={{ alignSelf: "flex-start" }} type="link" onClick={() => setEditing(true)}>
              {edit ? "编辑草稿" : draftResponse ? "编辑回应" : "回应批注"}
            </Button>
          )}
    </Stack>
  );
}

function ThreadGroup({
  group,
  detail,
  taskId,
  canRespond
}: { group: AnnotationGroup; detail: InstanceDetail; taskId?: string; canRespond: boolean }) {
  return <Stack gap={12}>{group.threads.map(thread => <Thread key={thread.annotation.id} canRespond={canRespond} detail={detail} taskId={taskId} thread={thread} />)}</Stack>;
}

export function AnnotationList({ detail, field }: { detail: InstanceDetail; field?: FieldAnchor }) {
  const {
    groups,
    task,
    canRespond
  } = useAnnotations(detail);
  const filtered = field
    ? groups.map(group => {
        return { ...group, threads: group.threads.filter(t => matchesField(t.annotation, field)) };
      }).filter(g => g.threads.length)
    : groups;
  return filtered.length > 0
    ? (
        <Stack gap={16}>
          {filtered.map(group => (
            <Stack key={group.threads[0]!.annotation.id} gap={8}>
              <Text strong>{group.name}</Text>
              <ThreadGroup canRespond={canRespond} detail={detail} group={group} taskId={task?.taskId} />
            </Stack>
          ))}
        </Stack>
      )
    : <Empty description="暂无批注" />;
}

export function AnnotationTimeline({ detail }: { detail: InstanceDetail }) {
  const {
    groups,
    task,
    canRespond
  } = useAnnotations(detail);
  const byEntry = new Map(groups.map(group => [group.entry, group]));
  const renderGroup = (group: AnnotationGroup) => <ThreadGroup key={group.threads[0]!.annotation.id} canRespond={canRespond} detail={detail} group={group} taskId={task?.taskId} />;
  return (
    <Stack gap={12}>
      <InstanceTimeline
        timeline={detail.timeline}
        renderEntryExtra={entry => {
          const group = byEntry.get(entry);
          return group && renderGroup(group);
        }}
      />

      {groups.filter(g => !g.entry).map(group => (
        <Stack key={group.threads[0]!.annotation.id} gap={6}>
          <Text strong>{group.name}</Text>
          {renderGroup(group)}
        </Stack>
      ))}
    </Stack>
  );
}

export function DetailAnnotations({ detail }: { detail: InstanceDetail }) {
  const { task, canRespond } = useAnnotations(detail);
  const [composing, setComposing] = useState(false);

  if (canRespond && detail.annotations?.length) {
    return (
      <Stack gap={8}>
        <Text strong>审批批注</Text>
        <AnnotationList detail={detail} />
      </Stack>
    );
  }

  if (!task) {
    return null;
  }

  return composing
    ? (
        <Stack gap={8}>
          <AnnotationComposer detail={detail} onDone={() => setComposing(false)} />
          <Button size="small" style={{ alignSelf: "flex-start" }} type="text" onClick={() => setComposing(false)}>取消</Button>
        </Stack>
      )
    : <Button style={{ alignSelf: "flex-start" }} onClick={() => setComposing(true)}>添加批注</Button>;
}

export function useFieldAnnotations(detail: InstanceDetail | undefined) {
  const [selected, setSelected] = useState<{ anchor: FieldAnchor; label?: string }>();
  const annotations = detail?.annotations;
  const byField = useMemo(() => {
    const fields = new Map<string, AnnotationView[]>();

    const items = annotations ?? [];

    for (const value of items) {
      if (value.parentId || !value.anchor || typeof value.anchor !== "object" || !("field" in value.anchor) || typeof value.anchor.field !== "string") {
        continue;
      }

      const key = value.anchor.field;
      const list = fields.get(key) ?? [];
      list.push(value);
      fields.set(key, list);
    }

    return fields;
  }, [annotations]);
  const renderFieldExtra = useMemo(() => {
    if (byField.size === 0) {
      return;
    }

    return ({
      key,
      label,
      row,
      column
    }: { key: string; label?: string; row?: number; column?: string }) => {
      const anchor = {
        field: key,
        row,
        column
      };
      const count = byField.get(key)?.filter(a => matchesField(a, anchor)).length;
      return count ? <Button size="small" type="link" onClick={() => setSelected({ anchor, label })}>{`${count} 条批注`}</Button> : null;
    };
  }, [byField]);
  const dialog = selected && detail && (
    <Modal
      open
      footer={null}
      styles={{ body: { maxHeight: "65dvh", overflowY: "auto" } }}
      title={selected.label ? `${selected.label} · 批注` : "字段批注"}
      onCancel={() => setSelected(undefined)}
    >
      <AnnotationList detail={detail} field={selected.anchor} />
    </Modal>
  );
  return { renderFieldExtra, dialog };
}
