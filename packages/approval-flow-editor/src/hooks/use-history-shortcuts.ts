import type { RefObject } from "react";

import { useEffect } from "react";

import { useEditorStoreApi } from "../store";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;

  return (
    tag === "INPUT"
    || tag === "TEXTAREA"
    || tag === "SELECT"
    || target.isContentEditable
  );
}

/**
 * Undo/redo keyboard shortcuts, scoped to the editor shell. The listener
 * attaches to the shell root (which carries `tabIndex={-1}` so clicking
 * anywhere inside focuses it), not `document`: keystrokes only reach it while
 * focus is inside this editor instance, so two mounted editors never execute
 * each other's shortcuts and the host page keeps its own key handling. Bails
 * out when the active element is a text input so the config panel keeps
 * native text undo.
 *
 * Shortcuts:
 * - Cmd/Ctrl + Z: undo
 * - Cmd/Ctrl + Shift + Z, Cmd/Ctrl + Y: redo
 *
 * Delete/Backspace stay with xyflow's native delete flow; Escape stays with
 * the canvas. Readonly editors ignore (and do not swallow) the shortcuts.
 */
export function useHistoryShortcuts(shellRef: RefObject<HTMLElement | null>): void {
  const storeApi = useEditorStoreApi();

  useEffect(() => {
    const shell = shellRef.current;

    if (!shell) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (isEditableTarget(event.target)) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;

      if (!mod) {
        return;
      }

      const {
        readonly,
        redo,
        undo
      } = storeApi.getState();

      if (readonly) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    }

    shell.addEventListener("keydown", handleKeyDown);
    return () => shell.removeEventListener("keydown", handleKeyDown);
  }, [storeApi, shellRef]);
}
