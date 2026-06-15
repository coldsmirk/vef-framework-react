import type { RefObject } from "react";

import { useEffect } from "react";

import { useFormEditorStoreApi } from "../store/form-store";
import { removeNodeWithConfirm } from "./remove-node-confirm";

/**
 * Keyboard shortcuts for the editor, scoped to the editor shell. The listener
 * attaches to the shell root (which carries `tabIndex={-1}` so clicking
 * anywhere inside focuses it), not `document`: keystrokes only reach it while
 * focus is inside this editor instance, so two mounted editors never execute
 * each other's shortcuts and the host page keeps its own key handling. Bails
 * out when the active element is a text input so typing into the properties
 * panel is not captured.
 *
 * Shortcuts:
 * - Delete: remove the selected node (edit mode only — the selection is not
 * rendered in preview / JSON view, so deleting it there would be invisible)
 * - Cmd/Ctrl + D: duplicate the selected node (edit mode only; still swallowed
 * in JSON view so the browser's bookmark dialog never opens mid-editing)
 * - Cmd/Ctrl + Z: undo
 * - Cmd/Ctrl + Shift + Z, Cmd/Ctrl + Y: redo
 * - Escape: clear selection
 *
 * Backspace is deliberately NOT bound to delete — it is a common source of
 * accidental field loss when the pointer briefly leaves an input.
 */
export function useEditorShortcuts(shellRef: RefObject<HTMLElement | null>): void {
  const storeApi = useFormEditorStoreApi();

  useEffect(() => {
    const shell = shellRef.current;

    if (!shell) {
      return;
    }

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

    function handleKeyDown(event: KeyboardEvent): void {
      if (isEditableTarget(event.target)) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      const {
        duplicateNode,
        redo,
        selectedId,
        selectNode,
        undo,
        viewMode
      } = storeApi.getState();

      if (viewMode === "preview") {
        return;
      }

      if (!mod && event.key === "Escape") {
        if (selectedId) {
          event.preventDefault();
          selectNode(null);
        }

        return;
      }

      if (!mod && event.key === "Delete") {
        // Edit-only: in JSON view the selection still exists in the store but is
        // not rendered (the edit tree is hidden), so a Delete there would
        // silently destroy a node the user cannot see. With no edit-mode
        // selection there is no browser default to suppress either.
        if (selectedId && viewMode === "edit") {
          event.preventDefault();
          // Impact-aware: cascade-pruned rules get a confirm, like the
          // toolbar delete button.
          removeNodeWithConfirm(storeApi, selectedId);
        }

        return;
      }

      if (mod && !event.shiftKey && event.key.toLowerCase() === "d") {
        // Swallow Cmd/Ctrl+D in every non-preview mode — inside the editor it
        // means "duplicate", never "bookmark this page". But only ACT on it in
        // edit mode: duplicating the invisible JSON-view selection is the same
        // unseen-mutation footgun as Delete above.
        event.preventDefault();

        if (selectedId && viewMode === "edit") {
          duplicateNode(selectedId);
        }

        return;
      }

      if (mod && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if (mod && ((event.shiftKey && event.key.toLowerCase() === "z") || event.key.toLowerCase() === "y")) {
        event.preventDefault();
        redo();
      }
    }

    shell.addEventListener("keydown", handleKeyDown);
    return () => shell.removeEventListener("keydown", handleKeyDown);
  }, [storeApi, shellRef]);
}
