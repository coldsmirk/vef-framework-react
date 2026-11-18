import type { PaginationResult } from "@vef-framework-react/core";
import type { ReactNode } from "react";

import type { AdminInstance, HandoverItem, HandoverReport } from "../../types";

import { Alert, Button, Drawer, Flex, Labeled, Modal, PermissionGate, Stack, Text, Title } from "@vef-framework-react/components";
import { useInView, useMutation, useQuery, useQueryClient } from "@vef-framework-react/core";
import { useId, useRef, useState } from "react";

import { useAdminApprovalApi, useMyApprovalApi } from "../../api";
import { AdminInstanceDetailPanel, PrincipalSelect } from "../../components";

function ReportGroup({
  title,
  count,
  children
}: { title: string; count: number; children: ReactNode }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <Title id={headingId} level={5} style={{ marginBlock: "0 6px" }}>{`${title}（${count}）`}</Title>

      {count > 0
        ? (
            <ul style={{
              listStyle: "none",
              padding: 0,
              margin: 0
            }}
            >
              {children}
            </ul>
          )
        : <Text type="secondary">无</Text>}
    </section>
  );
}

/**
 * Resolve titles outside the cached admin list only as their report rows come into view.
 */
function InstanceTitle({ instanceId }: { instanceId: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true });
  const api = useAdminApprovalApi();
  const { data } = useQuery({
    queryFn: api.getInstanceDetail,
    queryKey: [api.getInstanceDetail.key, { instanceId }],
    enabled: visible
  });

  return <span ref={ref}>{data?.instance.title || data?.instance.instanceNo || `查看审批单（${instanceId}）`}</span>;
}

function Report({ report, canViewDetail }: { report: HandoverReport; canViewDetail: boolean }) {
  const api = useAdminApprovalApi();
  const client = useQueryClient();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const transferred = report.transferred ?? [];
  const unassigned = report.unassigned ?? [];
  const awaiting = report.awaitingApplicant ?? [];
  // The report carries only instance ids. Reuse names already loaded by the admin list.
  const names = new Map<string, string>();
  const pages = client.getQueriesData<PaginationResult<AdminInstance>>({ queryKey: [api.findInstances.key] });

  for (const [, page] of pages) {
    const instances = page?.items ?? [];

    for (const instance of instances) {
      names.set(instance.instanceId, instance.title || instance.instanceNo);
    }
  }

  function instanceLink(id: string) {
    const label = names.get(id);

    return canViewDetail
      ? <Button size="small" type="link" onClick={() => setInstanceId(id)}>{label || <InstanceTitle instanceId={id} />}</Button>
      : <Text>{label || `审批单 ${id}（无详情权限）`}</Text>;
  }

  function workItem(item: HandoverItem) {
    const predecessor = item.predecessor.name || item.predecessor.id;
    const successor = item.successor && (item.successor.name || item.successor.id);

    return (
      <li key={item.taskId ? `task:${item.taskId}` : `cc:${item.ccRecordId}`}>
        <Flex align="baseline" gap={8} wrap="wrap">
          <Text type="secondary">{item.ccRecordId ? "抄送回执" : "待办"}</Text>
          <Text>{successor ? `${predecessor} → ${successor}` : predecessor}</Text>
          {instanceLink(item.instanceId)}
        </Flex>
      </li>
    );
  }

  return (
    <Stack gap={16}>
      <ReportGroup count={transferred.length} title="已转移">{transferred.map(item => workItem(item))}</ReportGroup>
      <ReportGroup count={unassigned.length} title="无接手人待处理">{unassigned.map(item => workItem(item))}</ReportGroup>

      <ReportGroup count={awaiting.length} title="待申请人处理的实例">
        {awaiting.map(id => <li key={id}>{instanceLink(id)}</li>)}
      </ReportGroup>

      <Drawer destroyOnHidden open={instanceId !== null} size={880} title="审批详情" onClose={() => setInstanceId(null)}>
        {instanceId !== null && <AdminInstanceDetailPanel instanceId={instanceId} />}
      </Drawer>
    </Stack>
  );
}

function HandoverDialog({ detailPermission, onClose }: { detailPermission: string; onClose: () => void }) {
  const api = useAdminApprovalApi();
  const my = useMyApprovalApi();
  const client = useQueryClient();
  const [userIds, setUserIds] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: api.applyHandovers,
    meta: { shouldShowSuccessFeedback: false },
    onSuccess() {
      const affected = [
        api.findInstances,
        api.findTasks,
        api.getInstanceDetail,
        api.findActionLogs,
        api.getMetrics,
        my.findPendingTasks,
        my.findCompletedTasks,
        my.findCCRecords,
        my.getPendingCounts,
        my.findInitiated,
        my.getInstanceDetail
      ];

      // A long-open admin list may already be stale while still showing its old rows.
      for (const query of affected) {
        void client.invalidateQueries({ queryKey: [query.key] });
      }
    }
  });

  return (
    <Modal
      centered
      open
      closable={!mutation.isPending}
      keyboard={!mutation.isPending}
      mask={{ closable: !mutation.isPending }}
      title={mutation.data ? "交接处理结果" : "按交接转移待办"}
      footer={mutation.data
        ? <Button type="primary" onClick={onClose}>完成</Button>
        : (
            <>
              <Button disabled={mutation.isPending} onClick={onClose}>取消</Button>
              <Button disabled={userIds.length === 0} loading={mutation.isPending} type="primary" onClick={() => mutation.mutate({ userIds })}>执行交接</Button>
            </>
          )}
      styles={{
        container: {
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100dvh - 32px)"
        },
        header: { flexShrink: 0 },
        body: { minHeight: 0, overflowY: "auto" },
        footer: { flexShrink: 0 }
      }}
      onCancel={onClose}
    >
      {mutation.data
        ? (
            <PermissionGate requiredPermissions={detailPermission}>
              {allowed => <Report canViewDetail={allowed} report={mutation.data} />}
            </PermissionGate>
          )
        : (
            <Stack gap={12}>
              <Labeled hint="按所选人员的交接记录转移待办和待确认的抄送回执。" label="已交接工作的人员">
                <PrincipalSelect disabled={mutation.isPending} kind="user" value={userIds} onChange={setUserIds} />
              </Labeled>

              {mutation.error && <Alert showIcon title={mutation.error.message} type="error" />}
            </Stack>
          )}
    </Modal>
  );
}

export function ApplyHandoversAction({ detailPermission }: { detailPermission: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>按交接转移待办</Button>
      {open && <HandoverDialog detailPermission={detailPermission} onClose={() => setOpen(false)} />}
    </>
  );
}
