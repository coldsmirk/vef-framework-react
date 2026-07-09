import type { DeviceRegistries, FieldPermission, FormRendererApi } from "@vef-framework-react/form-editor";
import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Button, CodeHighlighter, Input, Modal, Page, Segmented, Space, Stack, Text, Title } from "@vef-framework-react/components";
import { createDefaultMobileRegistry, createDefaultRegistry, FormRenderer, RegistryProvider } from "@vef-framework-react/form-editor";
import { useMemo, useRef, useState } from "react";

import { MOCK_FORM_DATA, MOCK_FORM_SCHEMA, MOCK_TASK_ID, VIEWER_PRESETS } from "./mock-data";

export const Route = createFileRoute("/_layout/sys/approval-task-demo")({
  component: RouteComponent
});

type TaskAction = "approve" | "reject";

/**
 * The `{taskId, action, opinion, formData}` shape `approval/instance.process_task`
 * accepts. This demo never calls a real endpoint — it only renders what the
 * request WOULD carry.
 */
interface TaskRequestPreview {
  taskId: string;
  action: TaskAction;
  opinion: string;
  formData: Record<string, unknown>;
}

const ACTION_LABELS: Record<TaskAction, string> = {
  approve: "通过",
  reject: "驳回"
};

const PRESET_OPTIONS = VIEWER_PRESETS.map(preset => {
  return { label: preset.label, value: preset.id };
});

// `FormRenderer` is a low-level primitive — unlike `FormEditor`, it does not
// self-wrap with a default registry, so a host mounting it directly must
// supply one. Built once at module scope: a fresh `FormFieldRegistry` per
// render would re-run every `.register()` call and change the context value
// identity on every re-render.
const FIELD_REGISTRIES: DeviceRegistries = {
  pc: createDefaultRegistry(),
  mobile: createDefaultMobileRegistry()
};

/**
 * Mirrors `isWritableFieldPermission` from the form-editor engine (not part of
 * its public API): only a clamp-free key, `"editable"`, or `"required"` may
 * reach the backend — `"visible"` / `"hidden"` are read-only or never-mounted
 * and must never leak into a submitted payload.
 */
function isWritablePermission(permission: FieldPermission | undefined): boolean {
  return permission === undefined || permission === "editable" || permission === "required";
}

function pickWritableValues(
  values: Record<string, unknown>,
  fieldPermissions: Record<string, FieldPermission>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => isWritablePermission(fieldPermissions[key]))
  );
}

function RouteComponent(): ReactNode {
  const [presetId, setPresetId] = useState(VIEWER_PRESETS[0]!.id);
  const preset = useMemo(
    () => VIEWER_PRESETS.find(item => item.id === presetId) ?? VIEWER_PRESETS[0]!,
    [presetId]
  );
  const showActionBar = preset.availableActions.length > 0;

  const [opinion, setOpinion] = useState("");
  const [preview, setPreview] = useState<TaskRequestPreview | null>(null);
  const formApiRef = useRef<FormRendererApi | null>(null);

  // The real detail page disables the whole form whenever the viewer has
  // nothing to execute — matching the CC preset's "read-only, no action bar".
  const formDisabled = !showActionBar;

  function handleFormSubmit(values: Record<string, unknown>): void {
    setPreview({
      taskId: MOCK_TASK_ID,
      action: "approve",
      opinion,
      formData: values
    });
  }

  async function handleApprove(): Promise<void> {
    // Runs the renderer's own validation + submit pipeline: an empty
    // `required`-clamped field blocks here (inline error on the field) and
    // `handleFormSubmit` never fires — exactly like the real `approve` action.
    await formApiRef.current?.submit();
  }

  function handleReject(): void {
    // The backend never blocks a reject on required fields, so this bypasses
    // the renderer's submit pipeline entirely and reads the live values
    // straight off the imperative handle.
    const values = formApiRef.current?.getValues() ?? {};

    setPreview({
      taskId: MOCK_TASK_ID,
      action: "reject",
      opinion,
      formData: pickWritableValues(values, preset.fieldPermissions)
    });
  }

  return (
    <RegistryProvider registries={FIELD_REGISTRIES}>
      <Page margin scrollable>
        <Stack gap="medium">
          <Stack gap="small">
            <Title level={4}>审批任务处理</Title>

            <Text type="secondary">
              演示 my.get_instance_detail 下发的 fieldPermissions 如何驱动 FormRenderer 的可见 / 只读 / 必填态，
              以及 instance.process_task 提交的请求体如何只携带可写字段。以下全部为本地模拟数据，不发起真实请求。
            </Text>
          </Stack>

          <Segmented options={PRESET_OPTIONS} value={presetId} onChange={value => setPresetId(String(value))} />
          <Text type="secondary">{preset.caption}</Text>

          {/*
            Keyed by preset: switching viewer simulates a fresh
            `my.get_instance_detail` response, so it remounts the form rather
            than re-clamping live state — which also drops any stale
            validation error a previous preset's failed submit left behind.
          */}
          <FormRenderer
            key={presetId}
            apiRef={formApiRef}
            defaultValues={MOCK_FORM_DATA}
            disabled={formDisabled}
            fieldPermissions={preset.fieldPermissions}
            schema={MOCK_FORM_SCHEMA}
            onSubmit={handleFormSubmit}
          />

          {showActionBar && (
            <Stack gap="small">
              <Text strong>审批意见</Text>

              <Input.TextArea
                placeholder="请输入审批意见（可选）"
                rows={3}
                value={opinion}
                onChange={event => setOpinion(event.target.value)}
              />

              <Space>
                <Button type="primary" onClick={handleApprove}>
                  通过
                </Button>

                <Button danger onClick={handleReject}>
                  驳回
                </Button>
              </Space>
            </Stack>
          )}
        </Stack>

        <Modal
          footer={null}
          open={preview !== null}
          title={preview ? `模拟请求预览 - ${ACTION_LABELS[preview.action]}` : "模拟请求预览"}
          onCancel={() => setPreview(null)}
        >
          {preview && (
            <CodeHighlighter language="json">
              {JSON.stringify(preview, null, 2)}
            </CodeHighlighter>
          )}
        </Modal>
      </Page>
    </RegistryProvider>
  );
}
