import type { UploadedFileMeta, UploadFile } from "@vef-framework-react/components";

import type { VoidOptions, VoidRecord, VoidTarget } from "../../types";

import { Alert, FileUpload, Input, Labeled, Stack, StoredFileUpload, Text } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { useState } from "react";

import { useAdminApprovalApi, useMyApprovalApi } from "../../api";
import { resolveBusinessRenderer, useApprovalPlugins } from "../../plugins";
import { PlanSummary } from "./summary";

export function useVoidDraft(target: VoidTarget, mode: "admin" | "requester", record?: VoidRecord) {
  const admin = useAdminApprovalApi();
  const my = useMyApprovalApi();
  const [reason, setReason] = useState(record?.reason ?? "");
  const [options, setOptions] = useState<VoidOptions>(record?.options ?? {});
  const [existing, setExisting] = useState(record?.attachments ?? []);
  const [files, setFiles] = useState<Array<UploadFile & Partial<UploadedFileMeta>>>([]);
  const queryFn = mode === "admin" ? admin.planVoid : my.planVoidAsRequester;
  const preview = useQuery({
    queryFn,
    queryKey: [queryFn.key, { instanceId: target.instanceId, options }],
    staleTime: 0,
    refetchOnMount: "always",
    retry: false
  });
  const plan = preview.data?.plan;
  const attachments = [...existing, ...files.filter(file => file.status === "done").map(file => file.key).filter((key): key is string => Boolean(key))];
  const uploadIssue = files.some(file => file.status === "error")
    ? "附件上传失败，请移除后重新上传"
    : files.some(file => file.status !== "done" || !file.key) ? "请等待附件上传完成" : undefined;
  const previewIssue = preview.error?.message ?? (preview.isFetching || !plan ? "正在获取作废计划" : undefined);
  const issue = previewIssue ?? (plan?.blockers.length ? "请先处理阻止事项" : undefined) ?? uploadIssue
    ?? (reason.trim() ? [...reason.trim()].length > 2000 ? "作废原因最多 2000 字" : undefined : "请填写作废原因");

  return {
    reason,
    setReason,
    options,
    setOptions,
    existing,
    setExisting,
    files,
    setFiles,
    preview,
    plan,
    previewIssue,
    uploadIssue,
    issue,
    attachments
  };
}

export function VoidFormFields({ target, draft }: { target: VoidTarget; draft: ReturnType<typeof useVoidDraft> }) {
  const { businessKinds } = useApprovalPlugins();
  const Options = resolveBusinessRenderer(businessKinds, target.businessKind)?.VoidOptions;
  return (
    <Stack gap={16}>
      {Options && <Labeled label="作废选项"><Options value={draft.options} onChange={draft.setOptions} /></Labeled>}

      {draft.preview.error
        ? <Alert showIcon description={draft.preview.error.message} title="无法获取作废计划" type="error" />
        : draft.previewIssue
          ? <Text role="status">{draft.previewIssue}</Text>
          : draft.plan && <PlanSummary plan={draft.plan} />}

      <Labeled required label="作废原因">
        <Input.TextArea
          aria-label="作废原因"
          maxLength={2000}
          placeholder="说明为什么需要作废这张审批单"
          rows={3}
          value={draft.reason}
          onChange={event => draft.setReason(event.target.value)}
        />
      </Labeled>

      <Labeled label="附件">
        <Stack gap={4}>
          {draft.existing.length > 0 && (
            <StoredFileUpload
              maxCount={draft.existing.length}
              value={draft.existing}
              onChange={value => draft.setExisting(Array.isArray(value) ? value : [])}
            >
              <span />
            </StoredFileUpload>
          )}

          {draft.existing.length < 20 && (
            <FileUpload
              multiple
              fileList={draft.files}
              maxCount={20 - draft.existing.length}
              onChange={({ fileList }) => draft.setFiles(fileList)}
            />
          )}

          {draft.uploadIssue && <Text type="secondary">{draft.uploadIssue}</Text>}
        </Stack>
      </Labeled>
    </Stack>
  );
}
