import type { BusinessFormHandle } from "../plugins";

import { Alert, showWarningMessage } from "@vef-framework-react/components";
import { useCallback, useRef, useState } from "react";

import { resolveBusinessRenderer, useApprovalPlugins } from "../plugins";

export function MissingBusinessKind() {
  return <Alert showIcon title="该业务类型未在本应用注册" type="warning" />;
}

export function useBusinessForm(kind?: string) {
  const { businessKinds } = useApprovalPlugins();
  const handle = useRef<BusinessFormHandle>(null);
  const renderer = resolveBusinessRenderer(businessKinds, kind);
  const [ready, setReady] = useState(true);
  const [blockedReason, setBlockedReason] = useState<string>();
  const onAvailabilityChange = useCallback((available: boolean, reason?: string) => {
    setReady(available);
    setBlockedReason(available ? undefined : reason);
  }, []);

  async function collect({ inlineError = false } = {}) {
    try {
      if (!handle.current) {
        throw new Error("业务表单尚未就绪");
      }

      return await handle.current.collect();
    } catch (error) {
      if (!inlineError) {
        showWarningMessage(error instanceof Error && error.message ? error.message : "请检查业务表单后重试");
      }

      throw error;
    }
  }

  return {
    renderer,
    handle,
    ready,
    blockedReason,
    onAvailabilityChange,
    collect
  };
}
