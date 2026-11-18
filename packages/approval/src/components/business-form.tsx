import type { BusinessFormHandle } from "../plugins";

import { Alert, showWarningMessage } from "@vef-framework-react/components";
import { useRef } from "react";

import { resolveBusinessRenderer, useApprovalPlugins } from "../plugins";

export function MissingBusinessKind() {
  return <Alert showIcon title="该业务类型未在本应用注册" type="warning" />;
}

export function useBusinessForm(kind?: string) {
  const { businessKinds } = useApprovalPlugins();
  const handle = useRef<BusinessFormHandle>(null);
  const renderer = resolveBusinessRenderer(businessKinds, kind);

  async function collect() {
    try {
      if (!handle.current) {
        throw new Error("业务表单尚未就绪");
      }

      return await handle.current.collect();
    } catch (error) {
      showWarningMessage(error instanceof Error && error.message ? error.message : "请检查业务表单后重试");
      throw error;
    }
  }

  return {
    renderer,
    handle,
    collect
  };
}
