import type { Except, SetRequired } from "@vef-framework-react/shared";
import type { MouseEvent, MouseEventHandler } from "react";

import type { ButtonProps } from "../button";
import type { ActionButtonProps } from "./props";

import { invokeAwaitableFn, isFunction } from "@vef-framework-react/shared";
import { useCallback, useState } from "react";

import { showConfirm } from "../_base";

type UseActionButtonOptions = SetRequired<
  Except<ActionButtonProps, keyof Except<ButtonProps, "loading" | "onClick">>,
  "confirmable" | "confirmMode" | "confirmTitle" | "confirmDescription"
>;

interface UseActionButtonReturn {
  loading: boolean;
  invokeClickAction: (event: MouseEvent<HTMLElement>, waitForActionDone?: boolean) => Promise<void>;
  handleClick: MouseEventHandler<HTMLElement>;
}

export function useActionButton({
  confirmable,
  confirmMode,
  confirmTitle,
  confirmDescription,
  onClick
}: UseActionButtonOptions): UseActionButtonReturn {
  const [loading, setLoading] = useState(false);

  const invokeClickAction = useCallback(async (event: MouseEvent<HTMLElement>, waitForActionDone = false) => {
    if (!isFunction(onClick)) {
      return;
    }

    const result = invokeAwaitableFn(onClick, [event], {
      onInvoke: () => setLoading(true),
      onFinally: () => setLoading(false)
    });

    if (waitForActionDone) {
      await result;
    }
  }, [onClick]);

  const handleShowConfirm = useCallback((event: MouseEvent<HTMLElement>) => {
    showConfirm(confirmDescription, {
      title: confirmTitle,
      onOk: () => invokeClickAction(event, true)
    });
  }, [confirmDescription, confirmTitle, invokeClickAction]);

  const handleClick = useCallback<MouseEventHandler<HTMLElement>>(event => {
    if (!confirmable) {
      invokeClickAction(event, false);
      return;
    }

    if (confirmMode === "dialog") {
      handleShowConfirm(event);
    }
  }, [confirmable, confirmMode, invokeClickAction, handleShowConfirm]);

  return {
    loading,
    invokeClickAction,
    handleClick
  };
}
