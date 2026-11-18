import type { AnnotationView, FieldAnchor, InstanceDetail, TimelineEntry } from "../../types";

import { useAppContext, useMutation, useQueryClient } from "@vef-framework-react/core";
import { useMemo } from "react";

import { useInstanceApi, useMyApprovalApi } from "../../api";
import { APPROVAL_PERMISSIONS } from "../../permissions";
import { resolveBusinessRenderer, useApprovalPlugins } from "../../plugins";
import { isMyInstanceDetail } from "../../types";

export interface AnnotationThread {
  annotation: AnnotationView;
  responses: AnnotationView[];
}

export interface AnnotationGroup {
  entry?: TimelineEntry;
  name: string;
  threads: AnnotationThread[];
}

function groupThreads(detail: InstanceDetail): AnnotationGroup[] {
  const groups = detail.timeline.map<AnnotationGroup>(entry => {
    return {
      entry,
      name: entry.name ?? "流转记录",
      threads: []
    };
  });
  const visits = new Map<string, AnnotationGroup>();
  const tasks = new Map<string, AnnotationGroup>();

  for (const group of groups) {
    if (group.entry?.visitId) {
      visits.set(group.entry.visitId, group);
    }

    const participants = group.entry?.participants ?? [];

    for (const participant of participants) {
      tasks.set(participant.taskId, group);
    }
  }

  const annotations = detail.annotations ?? [];
  const threads = new Map(annotations.filter(a => !a.parentId).map(a => [a.id, { annotation: a, responses: [] as AnnotationView[] }]));

  for (const annotation of annotations) {
    if (!annotation.parentId) {
      continue;
    }

    const parent = threads.get(annotation.parentId);

    if (parent) {
      parent.responses.push(annotation);
    } else {
      threads.set(annotation.id, { annotation, responses: [] });
    }
  }

  const unmatched = new Map<string, AnnotationGroup>();

  for (const thread of threads.values()) {
    const { annotation } = thread;
    const group = visits.get(annotation.visitId ?? "") ?? tasks.get(annotation.taskId ?? "");

    if (group) {
      group.threads.push(thread);
    } else {
      const key = annotation.visitId ?? annotation.taskId ?? annotation.nodeId;
      const other = unmatched.get(key) ?? { name: annotation.nodeName || "其他批注", threads: [] };
      other.threads.push(thread);
      unmatched.set(key, other);
    }
  }

  return [...groups, ...unmatched.values()].filter(group => group.threads.length > 0);
}

export function matchesField(annotation: AnnotationView, location: FieldAnchor): boolean {
  const { anchor } = annotation;
  return typeof anchor === "object" && anchor !== null && "field" in anchor && anchor.field === location.field
    && (location.row === undefined || ("row" in anchor && anchor.row === location.row))
    && (location.column === undefined || ("column" in anchor && anchor.column === location.column));
}

export function useAnnotations(detail: InstanceDetail) {
  const api = useInstanceApi();
  const { getInstanceDetail } = useMyApprovalApi();
  const { hasPermission } = useAppContext();
  const { businessKinds } = useApprovalPlugins();
  const kind = detail.instance.businessKind;
  const writable = (hasPermission?.(APPROVAL_PERMISSIONS.annotation.write) ?? true)
    && (!kind || Boolean(resolveBusinessRenderer(businessKinds, kind)));
  const mine = isMyInstanceDetail(detail) ? detail : undefined;
  const task = writable ? mine?.myTask : undefined;
  const canRespond = writable && detail.instance.status === "returned" && Boolean(mine?.availableActions.includes("resubmit"));
  const client = useQueryClient();
  const onSuccess = () => client.invalidateQueries({ queryKey: [getInstanceDetail.key, { instanceId: detail.instance.instanceId }] });
  const meta = { shouldShowSuccessFeedback: false };
  const save = useMutation({
    mutationFn: api.saveAnnotation,
    meta,
    onSuccess
  });
  const remove = useMutation({
    mutationFn: api.deleteAnnotation,
    meta,
    onSuccess
  });
  const groups = useMemo(() => groupThreads(detail), [detail]);
  return {
    groups,
    task,
    canRespond,
    save: save.mutateAsync,
    remove: remove.mutateAsync,
    pending: save.isPending || remove.isPending
  };
}
