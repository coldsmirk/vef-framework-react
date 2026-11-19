import type { Interval } from "@vef-framework-react/calendar";
import type { FormRendererApi } from "@vef-framework-react/form-editor";

import type { VoidTarget } from "../../types";

import { Alert, Button, Drawer, Empty, Flex, globalCssVars, Icon, showSuccessMessage, showWarningMessage, Spin, Stack, Text } from "@vef-framework-react/components";
import { isBusinessError, useMutation, useQuery, useQueryClient } from "@vef-framework-react/core";
import { SendIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useInstanceApi, useMyApprovalApi } from "../../api";
import { InstanceFormPanel } from "../../components";
import { MissingBusinessKind, useBusinessForm } from "../../components/business-form";
import { FlowIcon } from "../../components/icon";
import { useFormSchema } from "../../plugins";

export interface StartInstanceDrawerProps {
  /**
   * The flow to start; `null` keeps the drawer closed.
   */
  flowCode: string | null;
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
  /**
   * Presents the server's reason after a closed initiation window dismisses the drawer.
   */
  onWindowClosed?: (message: string) => void;
  voidTarget?: VoidTarget;
}

const WARNING_PERIOD_MS = 30 * 60_000;
const deadlineFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function DeadlineHint({ startsAtUnixMs, endsAtUnixMs: end }: Interval) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (end === undefined) {
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const deadline = end;

    function tick() {
      const clock = Date.now();
      setNow(clock);
      const remaining = deadline - clock;

      if (remaining > 0) {
        const delay = remaining >= WARNING_PERIOD_MS ? remaining - WARNING_PERIOD_MS + 1 : remaining;
        timer = setTimeout(tick, Math.min(delay, 2_147_483_647));
      }
    }

    tick();

    return () => clearTimeout(timer);
  }, [end]);

  const startedEarlier = startsAtUnixMs === undefined;

  if (end === undefined) {
    return <Text type="secondary">{startedEarlier ? "此前已开放 · 长期开放" : "长期开放"}</Text>;
  }

  if (now >= end) {
    return <Alert showIcon title="本次发起时段已截止" type="warning" />;
  }

  if (end - now < WARNING_PERIOD_MS) {
    const deadline = `发起时段将于 ${deadlineFormat.format(end)} 截止，请在截止前提交。`;

    return <Alert showIcon title={startedEarlier ? `此前已开放，${deadline}` : deadline} type="warning" />;
  }

  return startedEarlier ? <Text type="secondary">此前已开放</Text> : null;
}

function StartDrawerBody({
  flowCode,
  businessRef,
  voidTarget,
  onClose,
  onStarted,
  onWindowClosed
}: { flowCode: string } & Omit<StartInstanceDrawerProps, "flowCode">) {
  const queryClient = useQueryClient();
  const myApi = useMyApprovalApi();
  const instanceApi = useInstanceApi();
  const formApiRef = useRef<FormRendererApi | null>(null);
  const reasonId = useId();
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // The load is gated exactly like starting: a rendered form implies a
  // startable flow (active, permitted, published).
  const {
    data: startForm,
    error,
    isLoading,
    isFetchedAfterMount
  } = useQuery({
    queryFn: myApi.getStartForm,
    queryKey: [myApi.getStartForm.key, { flowCode }],
    staleTime: 0,
    refetchOnMount: "always"
  });

  const schema = useFormSchema(startForm?.businessKind ? undefined : startForm?.formSchema);
  const business = useBusinessForm(startForm?.businessKind);
  const handled = useRef<Error | null>(null);
  const handleClosedWindow = useCallback((reason: unknown) => {
    if (!(isBusinessError(reason) && reason.code === 40_027) || handled.current === reason) {
      return;
    }

    handled.current = reason;
    (onWindowClosed ?? showWarningMessage)(reason.message);
    onClose();
    void queryClient.invalidateQueries({ queryKey: [myApi.findAvailableFlows.key] });
  }, [myApi, onClose, onWindowClosed, queryClient]);

  useEffect(() => {
    if (isFetchedAfterMount) {
      handleClosedWindow(error);
    }
  }, [error, handleClosedWindow, isFetchedAfterMount]);

  const start = useMutation({
    mutationFn: instanceApi.start,
    meta: { shouldShowSuccessFeedback: false, invalidates: [[myApi.findInitiated.key] as const] }
  });

  async function submitStart(values: Record<string, unknown> | undefined): Promise<void> {
    setSubmitting(true);
    setSubmitError("");

    try {
      await start.mutateAsync({
        flowCode,
        businessRef,
        formData: startForm?.businessKind ? await business.collect() : values
      });
      showSuccessMessage("已提交审批");
      onClose();
      onStarted?.();
    } catch (error_) {
      handleClosedWindow(error_);

      if (voidTarget && error_ instanceof Error) {
        setSubmitError(error_.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitClick(): Promise<void> {
    if (schema) {
      // The renderer's validation pipeline gates submission; onSubmit below
      // only fires when it passes.
      await formApiRef.current?.submit();

      return;
    }

    await submitStart(undefined);
  }

  if (isLoading || !isFetchedAfterMount) {
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

      {startForm.initiationWindow?.open && startForm.initiationWindow.current && <DeadlineHint {...startForm.initiationWindow.current} />}

      {startForm.businessKind
        ? business.renderer ? <business.renderer.StartForm businessRef={businessRef} flow={startForm} handle={business.handle} voidTarget={voidTarget} onAvailabilityChange={business.onAvailabilityChange} /> : <MissingBusinessKind />
        : (
            <InstanceFormPanel
              apiRef={formApiRef}
              applicant={startForm.applicant}
              globals={startForm.globals}
              schema={schema}
              onSubmit={values => void submitStart(values)}
            />
          )}

      {submitError && <Alert showIcon title={submitError} type="error" />}

      <Flex
        align="center"
        gap="small"
        justify="flex-end"
        style={{ borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`, paddingTop: 16 }}
        wrap="wrap"
      >
        {business.blockedReason && <Text id={reasonId} type="secondary">{business.blockedReason}</Text>}

        <Button
          aria-describedby={business.blockedReason ? reasonId : undefined}
          disabled={Boolean(startForm.businessKind && (!business.renderer || !business.ready))}
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
  businessRef,
  voidTarget,
  onClose,
  onStarted,
  onWindowClosed
}: StartInstanceDrawerProps) {
  return (
    <Drawer
      destroyOnHidden
      open={flowCode !== null}
      placement="right"
      size={720}
      title={voidTarget ? "申请作废" : "发起审批"}
      onClose={onClose}
    >
      {flowCode !== null && (
        <StartDrawerBody
          key={flowCode}
          businessRef={businessRef}
          flowCode={flowCode}
          voidTarget={voidTarget}
          onClose={onClose}
          onStarted={onStarted}
          onWindowClosed={onWindowClosed}
        />
      )}
    </Drawer>
  );
}
