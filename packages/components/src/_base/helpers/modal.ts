import type { Awaitable, Except } from "@vef-framework-react/shared";
import type { ButtonProps, ModalFuncProps } from "antd";
import type { ReactNode } from "react";

import type { Length, SemanticScene } from "../types";

import { assign, isFunction } from "@vef-framework-react/shared";

import { semanticSceneLabels } from "../constants/common";
import { getVefGlobal } from "../globals";

export interface ConfirmOptions {
  title?: ReactNode;
  okText?: ReactNode;
  cancelText?: ReactNode;
  okButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
  width?: Length;
  closable?: boolean;
  onOk?: () => Awaitable<void>;
  onCancel?: () => Awaitable<void>;
  onAfterOpen?: () => void;
  onAfterClose?: () => void;
}

export type AlertOptions = Except<ConfirmOptions, "cancelText" | "cancelButtonProps">;

export interface ModalHandle {
  close: () => void;
  update: (content: ReactNode, options?: ConfirmOptions) => void;
}

export interface AlertHandle {
  close: () => void;
  update: (content: ReactNode, options?: AlertOptions) => void;
}

export function showConfirm(content: ReactNode, options?: ConfirmOptions): ModalHandle {
  const { destroy, update } = getModal().confirm(buildConfirmProps(content, options));

  return {
    close: destroy,
    update: (newContent: ReactNode, newOptions?: ConfirmOptions) => {
      update((prevOptions: ModalFuncProps) => assign(prevOptions, buildConfirmProps(newContent, newOptions)));
    }
  };
}

export function showSuccessAlert(content: ReactNode, options?: AlertOptions): AlertHandle {
  return showAlert("success", content, options);
}

export function showInfoAlert(content: ReactNode, options?: AlertOptions): AlertHandle {
  return showAlert("info", content, options);
}

export function showWarningAlert(content: ReactNode, options?: AlertOptions): AlertHandle {
  return showAlert("warning", content, options);
}

export function showErrorAlert(content: ReactNode, options?: AlertOptions): AlertHandle {
  return showAlert("error", content, options);
}

function showAlert(
  scene: SemanticScene,
  content: ReactNode,
  options?: AlertOptions
): AlertHandle {
  const { destroy, update } = getModal()[scene](buildAlertProps(scene, content, options));

  return {
    close: destroy,
    update: (newContent: ReactNode, newOptions?: AlertOptions) => {
      update((prevOptions: ModalFuncProps) => assign(prevOptions, buildAlertProps(scene, newContent, newOptions)));
    }
  };
}

function buildAfterOpenChange(
  onAfterOpen?: () => void,
  onAfterClose?: () => void
): ((open: boolean) => void) | undefined {
  if (!isFunction(onAfterOpen) && !isFunction(onAfterClose)) {
    return undefined;
  }

  return (open: boolean) => {
    if (open) {
      onAfterOpen?.();
    } else {
      onAfterClose?.();
    }
  };
}

function buildConfirmProps(content: ReactNode, options?: ConfirmOptions): ModalFuncProps {
  const {
    title = "确认提示",
    okText,
    cancelText,
    okButtonProps,
    cancelButtonProps,
    width,
    closable = true,
    onOk,
    onCancel,
    onAfterOpen,
    onAfterClose
  } = options ?? {};

  return {
    title,
    content,
    okText,
    cancelText,
    centered: true,
    okButtonProps,
    cancelButtonProps,
    closable,
    width,
    onOk,
    onCancel,
    afterOpenChange: buildAfterOpenChange(onAfterOpen, onAfterClose)
  };
}

function buildAlertProps(
  scene: SemanticScene,
  content: ReactNode,
  options?: AlertOptions
): ModalFuncProps {
  const {
    title = semanticSceneLabels[scene],
    okText = "好的，知道了",
    okButtonProps,
    width,
    closable = false,
    onOk,
    onCancel,
    onAfterOpen,
    onAfterClose
  } = options ?? {};

  return {
    title,
    content,
    okText,
    okButtonProps,
    centered: true,
    width,
    closable,
    onOk,
    onCancel,
    afterOpenChange: buildAfterOpenChange(onAfterOpen, onAfterClose)
  };
}

function getModal() {
  return getVefGlobal().modal;
}
