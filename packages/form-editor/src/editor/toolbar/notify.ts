/**
 * Lightweight bridge over the framework's global message / modal APIs so
 * the form editor can surface success / error notifications and confirm
 * dialogs without hard-coupling to the starter's wiring.
 *
 * When the editor is mounted standalone (tests, isolated demos) the global
 * `$vef` does not exist; in that case we fall back to the browser's native
 * `alert` / `confirm` so user feedback still happens, just less gracefully.
 */

import type { ReactNode } from "react";

export type NotifyKind = "success" | "warning" | "error";

export function notify(kind: NotifyKind, text: string): void {
  const messager = globalThis.$vef?.message;

  if (messager) {
    switch (kind) {
      case "success": {
        messager.success(text);
        break;
      }

      case "warning": {
        messager.warning(text);
        break;
      }

      case "error": {
        messager.error(text);
        break;
      }
    }

    return;
  }

  switch (kind) {
    case "error": {
      console.error("[form-editor]", text);
      // eslint-disable-next-line no-alert -- intentional fallback when $vef.message is unavailable
      globalThis.alert?.(text);
      break;
    }

    case "warning": {
      console.warn("[form-editor]", text);
      break;
    }

    case "success": {
      console.info("[form-editor]", text);
      break;
    }
  }
}

/**
 * Informational modal for post-action reports (e.g. a lossy conversion's
 * dropped-component list) — content the user should read once, with no
 * decision attached. `content` is the rich (React) body for the modal; the
 * optional `detail` is a plain-text rendering of the same information for the
 * `$vef`-less fallback (standalone / tests), where the React body cannot be
 * shown and the title alone would drop the actual report.
 */
export function infoDialog(title: string, content: ReactNode, detail?: string): void {
  const modal = globalThis.$vef?.modal;

  if (modal) {
    modal.info({
      title,
      content,
      okText: "知道了"
    });
    return;
  }

  console.info("[form-editor]", detail === undefined ? title : `${title}\n${detail}`);
}

export interface ConfirmDialogOptions {
  onOk: () => void;
  /**
   * Visual intent of the confirm button.
   *
   * @default "danger"
   */
  okType?: "danger" | "primary";
  /**
   * Plain-text rendering of a rich (React) `content` for the `$vef`-less
   * native fallback, where the React body cannot be shown and the title alone
   * would drop the substance of the question (mirrors `infoDialog`'s
   * `detail`). Unnecessary when `content` is already a string.
   */
  detail?: string;
}

export function confirmDialog(title: string, content: ReactNode, options: ConfirmDialogOptions): void {
  const {
    detail,
    okType = "danger",
    onOk
  } = options;
  const modal = globalThis.$vef?.modal;

  if (modal) {
    modal.confirm({
      title,
      content,
      okText: "确认",
      okType,
      cancelText: "取消",
      onOk
    });
    return;
  }

  // The native fallback can only show text: a string content is used verbatim,
  // a rich body falls back to `detail`, and only as a last resort the title.
  const text = typeof content === "string" ? content : detail;

  // eslint-disable-next-line no-alert -- intentional fallback when $vef.modal is unavailable
  if (globalThis.confirm?.(text === undefined ? title : `${title}\n\n${text}`)) {
    onOk();
  }
}
