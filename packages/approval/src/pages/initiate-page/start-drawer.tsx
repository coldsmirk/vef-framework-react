import type { FormRendererApi } from "@vef-framework-react/form-editor";

import { Button, Drawer, Empty, Flex, globalCssVars, Icon, showSuccessMessage, Spin, Stack, Text } from "@vef-framework-react/components";
import { useMutation, useQuery } from "@vef-framework-react/core";
import { SendIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useInstanceApi, useMyApprovalApi } from "../../api";
import { InstanceFormPanel } from "../../components";
import { FlowIcon } from "../../components/icon";

export interface StartInstanceDrawerProps {
  /**
   * The flow to start; `null` keeps the drawer closed.
   */
  flowCode: string | null;
  tenantId: string;
  /**
   * Prefilled business reference for business-bound flows started from a
   * host business page.
   */
  businessRef?: string;
  onClose: () => void;
  /**
   * Fired with the submission acknowledged, after the drawer closes.
   */
  onStarted?: () => void;
}

function StartDrawerBody({
  flowCode,
  tenantId,
  businessRef,
  onClose,
  onStarted
}: { flowCode: string } & Omit<StartInstanceDrawerProps, "flowCode">) {
  const myApi = useMyApprovalApi();
  const instanceApi = useInstanceApi();
  const formApiRef = useRef<FormRendererApi | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The load is gated exactly like starting: a rendered form implies a
  // startable flow (active, permitted, published).
  const { data: startForm, isLoading } = useQuery({
    queryFn: myApi.getStartForm,
    queryKey: [myApi.getStartForm.key, { tenantId, flowCode }]
  });

  const start = useMutation({
    mutationFn: instanceApi.start,
    meta: { shouldShowSuccessFeedback: false, invalidates: [[myApi.findInitiated.key] as const] }
  });

  async function submitStart(values: Record<string, unknown> | undefined): Promise<void> {
    setSubmitting(true);

    try {
      await start.mutateAsync({
        tenantId,
        flowCode,
        businessRef,
        formData: values
      });
      showSuccessMessage("已提交审批");
      onClose();
      onStarted?.();
    } catch {
      /* surfaced by the http client */
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitClick(): Promise<void> {
    if (startForm?.formSchema) {
      // The renderer's validation pipeline gates submission; onSubmit below
      // only fires when it passes.
      await formApiRef.current?.submit();

      return;
    }

    await submitStart(undefined);
  }

  if (isLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 240 }}>
        <Spin />
      </Flex>
    );
  }

  if (!startForm) {
    return <Empty description="无法加载该流程的表单" />;
  }

  return (
    <Stack gap={16}>
      <Flex align="center" gap="small">
        <FlowIcon name={startForm.flowIcon} size={20} />
        <Text strong style={{ fontSize: 16 }}>{startForm.flowName}</Text>
        <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">{`v${startForm.version}`}</Text>
      </Flex>

      {startForm.description !== undefined && startForm.description !== ""
        && <Text type="secondary">{startForm.description}</Text>}

      <InstanceFormPanel
        apiRef={formApiRef}
        schema={startForm.formSchema}
        onSubmit={values => void submitStart(values)}
      />

      <Flex
        justify="flex-end"
        style={{ borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`, paddingTop: 16 }}
      >
        <Button
          icon={<Icon component={SendIcon} />}
          loading={submitting}
          type="primary"
          onClick={() => void handleSubmitClick()}
        >
          提交审批
        </Button>
      </Flex>
    </Stack>
  );
}

/**
 * The initiation drawer: loads the published form document through the
 * start-gate (`my.get_start_form`) and submits `instance.start` with the
 * renderer-validated form data.
 */
export function StartInstanceDrawer({
  flowCode,
  tenantId,
  businessRef,
  onClose,
  onStarted
}: StartInstanceDrawerProps) {
  return (
    <Drawer
      destroyOnHidden
      open={flowCode !== null}
      placement="right"
      size={720}
      title="发起审批"
      onClose={onClose}
    >
      {flowCode !== null && (
        <StartDrawerBody
          businessRef={businessRef}
          flowCode={flowCode}
          tenantId={tenantId}
          onClose={onClose}
          onStarted={onStarted}
        />
      )}
    </Drawer>
  );
}
