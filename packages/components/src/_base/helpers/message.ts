import type { ReactNode } from "react";

import { generateId } from "@vef-framework-react/shared";

import { getVefGlobal } from "../globals";

export function showSuccessMessage(content: ReactNode): void {
  getMessage().success(content, 1.5);
}

export function showInfoMessage(content: ReactNode): void {
  getMessage().info(content, 2);
}

export function showWarningMessage(content: ReactNode): void {
  getMessage().warning(content, 3);
}

export function showErrorMessage(content: ReactNode): void {
  getMessage().error(content, 4);
}

export interface LoadingMessageHandle {
  close: () => void;
  update: (content: ReactNode) => void;
}

export function showLoadingMessage(content: ReactNode): LoadingMessageHandle {
  const id = generateId();

  getMessage().open({
    key: id,
    type: "loading",
    duration: 0,
    content
  });

  return {
    close: () => getMessage().destroy(id),
    update: (newContent: ReactNode) => {
      getMessage().open({
        key: id,
        type: "loading",
        duration: 0,
        content: newContent
      });
    }
  };
}

export function closeAllMessages(): void {
  getMessage().destroy();
}

function getMessage() {
  return getVefGlobal().message;
}
