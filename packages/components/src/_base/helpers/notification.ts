import type { ArgsProps } from "antd/es/notification";
import type { ReactNode } from "react";

import type { SemanticScene } from "../types";

import { generateId } from "@vef-framework-react/shared";

import { semanticSceneLabels } from "../constants/common";
import { getVefGlobal } from "../globals";

export interface NotificationOptions {
  title?: ReactNode;
  duration?: number;
  actions?: ReactNode;
  closable?: boolean;
  icon?: ReactNode;
}

export interface NotificationHandle {
  close: () => void;
  update: (content: ReactNode, options?: NotificationOptions) => void;
}

const durationMap: Record<SemanticScene, number> = {
  success: 3,
  info: 4,
  warning: 5,
  error: 6
};

export function showSuccessNotification(
  content: ReactNode,
  options?: NotificationOptions
): NotificationHandle {
  return showNotification("success", content, options);
}

export function showInfoNotification(
  content: ReactNode,
  options?: NotificationOptions
): NotificationHandle {
  return showNotification("info", content, options);
}

export function showWarningNotification(
  content: ReactNode,
  options?: NotificationOptions
): NotificationHandle {
  return showNotification("warning", content, options);
}

export function showErrorNotification(
  content: ReactNode,
  options?: NotificationOptions
): NotificationHandle {
  return showNotification("error", content, options);
}

export function closeAllNotifications(): void {
  getNotification().destroy();
}

function showNotification(
  scene: SemanticScene,
  content: ReactNode,
  options?: NotificationOptions
): NotificationHandle {
  const key = generateId();

  getNotification().open(buildNotificationArgs(key, scene, content, options));

  return {
    close: () => getNotification().destroy(key),
    update: (newContent: ReactNode, newOptions?: NotificationOptions) => {
      getNotification().open(buildNotificationArgs(key, scene, newContent, newOptions));
    }
  };
}

function buildNotificationArgs(
  key: string,
  scene: SemanticScene,
  content: ReactNode,
  options?: NotificationOptions
): ArgsProps {
  const {
    title = semanticSceneLabels[scene],
    duration = durationMap[scene],
    actions,
    closable = true,
    icon
  } = options ?? {};

  return {
    key,
    type: scene,
    title,
    description: content,
    duration,
    actions,
    showProgress: true,
    pauseOnHover: true,
    closable,
    icon
  };
}

function getNotification() {
  return getVefGlobal().notification;
}
