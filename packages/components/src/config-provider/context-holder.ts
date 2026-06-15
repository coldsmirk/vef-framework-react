import type { ReactNode } from "react";

import { useIsomorphicEffect } from "@vef-framework-react/hooks";
import { App } from "antd";

import { setVefGlobal } from "../_base/globals";

interface ContextHolderProps {
  children?: ReactNode;
}

export default function ContextHolder({ children }: ContextHolderProps): ReactNode {
  const {
    message,
    notification,
    modal
  } = App.useApp();

  useIsomorphicEffect(() => {
    setVefGlobal({
      message,
      notification,
      modal
    });
  }, [message, notification, modal]);

  return children;
}
