import type { AnnotationView, FieldAnchor, InstanceDetail } from "../../types";
import type { AnnotationGroup, AnnotationThread } from "./use-annotations";

import { Alert, Button, Empty, Flex, globalCssVars, Modal, Stack, Text } from "@vef-framework-react/components";
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

function AnnotationLine({ value, detail }: { value: AnnotationView; detail: InstanceDetail }) {
  const { audience } = value;
  const names = audience.scope === "nodes"
    ? detail.flowGraph.nodes.filter(node => audience.nodeIds.includes(node.nodeId)).map(node => node.data.name).filter(Boolean)
    : [];
  return (
    <Stack gap={4}>
      <Flex align="baseline" gap="small" wrap="wrap">
        <Text strong>{value.author.name}</Text>
        <Text type="secondary">{value.status === "discarded" && value.parentId ? "已作废（审批单已结束）" : statuses[value.status]}</Text>
        {value.resolution && <Text>{value.resolution === "addressed" ? "已修改" : "不采纳"}</Text>}
        <Text type="secondary">{names.length > 0 ? `指定节点可见（${names.join("、")}）` : audiences[audience.scope]}</Text>
      </Flex>

      {value.content && <Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value.content}</Text>}
    </Stack>
  );
}

function Thread({
  detail,
  thread,
  actions
}: {
  detail: InstanceDetail;
  thread: AnnotationThread;
  actions: ReturnType<typeof useAnnotations>;
}) {
  const { annotation, responses } = thread;
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const draftResponse = responses.find(r => r.status === "draft");
  const respond = actions.canRespond && annotation.status === "published" && !annotation.parentId;
  const edit = actions.task && annotation.taskId === actions.task.taskId && annotation.status === "draft" && !annotation.parentId;

  async function deleteDraft() {
    setDeleteError("");

    try {
      await actions.remove({ id: annotation.id });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "未能删除草稿，请重试");
    }
  }

  return (
    <Stack gap={8} style={{ borderInlineStart: `2px solid ${globalCssVars.colorBorderSecondary}`, paddingInlineStart: 12 }}>
      <AnnotationLine detail={detail} value={annotation} />
      {responses.map(response => <div key={response.id} style={{ paddingInlineStart: 12 }}><AnnotationLine detail={detail} value={response} /></div>)}

      {editing
        ? edit
          ? <AnnotationComposer detail={detail} draft={annotation} onCancel={() => setEditing(false)} onDone={() => setEditing(false)} />
          : <AnnotationResponseComposer detail={detail} draft={draftResponse} parent={annotation} onCancel={() => setEditing(false)} onDone={() => setEditing(false)} />

        : (edit || respond) && (
            <Flex gap="small">
              <Button disabled={actions.pending} size="small" type="link" onClick={() => setEditing(true)}>
                {edit ? "编辑草稿" : draftResponse ? "编辑回应" : "回应批注"}
              </Button>

              {edit && <Button danger disabled={actions.pending} size="small" type="link" onClick={() => void deleteDraft()}>删除草稿</Button>}
            </Flex>
          )}

      {!editing && deleteError && <Alert showIcon title={deleteError} type="error" />}
    </Stack>
  );
}

function ThreadGroup({
  group,
  detail,
  actions
}: { group: AnnotationGroup; detail: InstanceDetail; actions: ReturnType<typeof useAnnotations> }) {
  return <Stack gap={12}>{group.threads.map(thread => <Thread key={thread.annotation.id} actions={actions} detail={detail} thread={thread} />)}</Stack>;
}

export function AnnotationList({ detail, field }: { detail: InstanceDetail; field?: FieldAnchor }) {
  const actions = useAnnotations(detail);
  const { groups } = actions;
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
              <ThreadGroup actions={actions} detail={detail} group={group} />
            </Stack>
          ))}
        </Stack>
      )
    : <Empty description="暂无批注" />;
}

export function AnnotationTimeline({ detail }: { detail: InstanceDetail }) {
  const actions = useAnnotations(detail);
  const { groups } = actions;
  const byEntry = new Map(groups.map(group => [group.entry, group]));
  const renderGroup = (group: AnnotationGroup) => <ThreadGroup key={group.threads[0]!.annotation.id} actions={actions} detail={detail} group={group} />;
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
  const actions = useAnnotations(detail);
  const { task, canRespond } = actions;
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

  const drafts = detail.annotations?.filter(annotation => annotation.taskId === task.taskId && annotation.status === "draft" && !annotation.parentId);
  return (
    <Stack gap={8}>
      {drafts?.map(annotation => <Thread key={annotation.id} actions={actions} detail={detail} thread={{ annotation, responses: [] }} />)}

      {composing
        ? <AnnotationComposer detail={detail} onCancel={() => setComposing(false)} onDone={() => setComposing(false)} />

        : <Button style={{ alignSelf: "flex-start" }} onClick={() => setComposing(true)}>添加批注</Button>}
    </Stack>
  );
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
