import type { AnnotationAudience, AnnotationResolution, AnnotationView, InstanceDetail } from "../../types";

import { projectFormSchema } from "@vef-framework-react/approval-form-bridge";
import { Alert, Button, Flex, Input, Labeled, Radio, Select, Stack } from "@vef-framework-react/components";
import { useMemo, useState } from "react";

import { useApprovalPlugins } from "../../plugins";
import { useAnnotations } from "./use-annotations";

interface ComposerProps {
  detail: InstanceDetail;
  draft?: AnnotationView;
  onDone?: () => void;
}

const scopes: Array<{ label: string; value: AnnotationAudience["scope"] }> = [
  { label: "所有参与人", value: "participants" },
  { label: "仅申请人", value: "applicant" },
  { label: "指定节点", value: "nodes" },
  { label: "指定人员", value: "users" }
];

function AudienceInput({
  detail,
  value,
  onChange
}: { detail: InstanceDetail; value: AnnotationAudience; onChange: (value: AnnotationAudience) => void }) {
  const { pickers } = useApprovalPlugins();
  const Picker = pickers?.user;
  const people = useMemo(() => {
    const users = new Map([[detail.instance.applicant.id, detail.instance.applicant.name]]);

    for (const { data } of detail.flowGraph.nodes) {
      for (const person of [...(data.ccRecipients ?? []).map(cc => cc.user), ...(data.participants ?? []).flatMap(p => p.delegator ? [p.user, p.delegator] : [p.user])]) {
        users.set(person.id, person.name);
      }
    }

    return [...users].map(([id, name]) => {
      return { label: name, value: id };
    });
  }, [detail]);

  return (
    <Stack gap={8}>
      <Labeled label="可见范围">
        <Select<AnnotationAudience["scope"]>
          aria-label="可见范围"
          options={scopes}
          value={value.scope}
          onChange={scope => onChange(scope === "users" ? { scope, userIds: [] } : scope === "nodes" ? { scope, nodeIds: [] } : { scope })}
        />
      </Labeled>

      {value.scope === "nodes" && (
        <Select<string[]>
          aria-label="可见节点"
          maxTagCount={1}
          mode="multiple"
          options={detail.flowGraph.nodes.map(node => { return { label: node.data.name, value: node.nodeId }; })}
          placeholder="选择流程节点"
          showSearch={{ optionFilterProp: "label" }}
          value={value.nodeIds}
          onChange={nodeIds => onChange({ scope: "nodes", nodeIds })}
        />
      )}

      {value.scope === "users" && (Picker
        ? <Picker value={value.userIds} onChange={userIds => onChange({ scope: "users", userIds })} />
        : (
            <Select<string[]>
              aria-label="可见人员"
              maxTagCount={1}
              mode="multiple"
              options={people}
              placeholder="搜索流程参与人"
              showSearch={{ optionFilterProp: "label" }}
              value={value.userIds}
              onChange={userIds => onChange({ scope: "users", userIds })}
            />
          ))}
    </Stack>
  );
}

function useDraftActions(detail: InstanceDetail, onDone?: () => void) {
  const annotations = useAnnotations(detail);
  const [error, setError] = useState("");

  async function run(write: () => Promise<unknown>) {
    setError("");

    try {
      await write();
      onDone?.();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "未能保存更改，请重试");
    }
  }

  return {
    ...annotations,
    error,
    run
  };
}

function DraftActions({
  draft,
  disabled,
  actions,
  save
}: {
  draft?: AnnotationView;
  disabled: boolean;
  actions: ReturnType<typeof useDraftActions>;
  save: () => Promise<unknown>;
}) {
  return (
    <>
      {actions.error && <Alert showIcon title={actions.error} type="error" />}

      <Flex gap="small">
        <Button disabled={disabled} loading={actions.pending} type="primary" onClick={() => void actions.run(save)}>保存草稿</Button>
        {draft && <Button danger disabled={actions.pending} onClick={() => void actions.run(() => actions.remove({ id: draft.id }))}>删除草稿</Button>}
      </Flex>
    </>
  );
}

export function AnnotationComposer({
  detail,
  anchor,
  draft,
  onDone
}: ComposerProps & { anchor?: unknown }) {
  const actions = useDraftActions(detail, onDone);
  const [content, setContent] = useState(draft?.content ?? "");
  const [audience, setAudience] = useState<AnnotationAudience>(draft?.audience ?? { scope: "participants" });
  const [field, setField] = useState<string>();
  const fields = useMemo(() => !detail.instance.businessKind && detail.formSchema
    ? projectFormSchema(detail.formSchema).fields.filter(f => !("fieldPermissions" in detail) || detail.fieldPermissions?.[f.key] !== "hidden")
    : [], [detail]);
  const { task } = actions;

  if (!task || (draft && (draft.status !== "draft" || draft.taskId !== task.taskId || draft.parentId))) {
    return null;
  }

  const needsAudience = (audience.scope === "nodes" && audience.nodeIds.length === 0) || (audience.scope === "users" && audience.userIds.length === 0);
  return (
    <Stack gap={12}>
      {!draft && anchor === undefined && fields.length > 0 && (
        <Labeled label="批注位置">
          <Select<string>
            allowClear
            aria-label="批注位置"
            options={fields.map(f => { return { label: f.label, value: f.key }; })}
            placeholder="整份表单"
            value={field}
            onChange={setField}
          />
        </Labeled>
      )}

      <Labeled label="批注内容"><Input.TextArea aria-label="批注内容" rows={3} value={content} onChange={e => setContent(e.target.value)} /></Labeled>
      <AudienceInput detail={detail} value={audience} onChange={setAudience} />

      <DraftActions
        actions={actions}
        disabled={!content.trim() || [...content].length > 4000 || needsAudience}
        draft={draft}
        save={() => actions.save({
          id: draft?.id,
          taskId: task.taskId,
          content,
          audience,
          anchor: draft ? draft.anchor : anchor ?? (field ? { field } : undefined)
        })}
      />
    </Stack>
  );
}

export function AnnotationResponseComposer({
  detail,
  parent,
  draft,
  onDone
}: ComposerProps & { parent: AnnotationView }) {
  const actions = useDraftActions(detail, onDone);
  const [content, setContent] = useState(draft?.content ?? "");
  const [resolution, setResolution] = useState<AnnotationResolution>(draft?.resolution ?? "addressed");

  if (!actions.canRespond || parent.status !== "published" || parent.parentId || (draft && (draft.status !== "draft" || draft.parentId !== parent.id))) {
    return null;
  }

  return (
    <Stack gap={12}>
      <Radio.Group
        aria-label="处理结果"
        options={[{ label: "已修改", value: "addressed" }, { label: "不采纳", value: "declined" }]}
        value={resolution}
        onChange={e => setResolution(e.target.value)}
      />

      <Labeled label={resolution === "declined" ? "不采纳原因" : "修改说明（可选）"}>
        <Input.TextArea aria-label="回应说明" rows={3} value={content} onChange={e => setContent(e.target.value)} />
      </Labeled>

      <DraftActions
        actions={actions}
        disabled={(!content.trim() && resolution === "declined") || [...content].length > 4000}
        draft={draft}
        save={() => actions.save({
          id: draft?.id,
          parentId: parent.id,
          resolution,
          content
        })}
      />
    </Stack>
  );
}
