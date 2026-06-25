import type { ReactElement, RefObject } from "react";

import type { FormEditorStoreApi } from "../store/form-store";
import type { FormSchema, TextfieldField } from "../types";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";

import { findNode } from "../engine/schema/walk";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../store/form-store";
import { useEditorShortcuts } from "./use-editor-shortcuts";

const FIELD_ID = "Field_1";

function makeField(): TextfieldField {
  return {
    id: FIELD_ID,
    type: "textfield",
    key: "textfield",
    label: "文本框"
  };
}

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [makeField()]
      }
    }
  };
}

interface ShortcutHarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

/**
 * Mirrors the editor shell's wiring: the hook listens on a `tabIndex={-1}`
 * shell root, with focusable targets inside it and one outside it.
 */
function ShortcutHarness({ onReady }: ShortcutHarnessProps): ReactElement {
  const api = useFormEditorStoreApi();
  const shellRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);

  useEditorShortcuts(shellRef);

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return (
    <>
      <div ref={shellRef} tabIndex={-1}>
        <button type="button">stage</button>
        <input aria-label="属性输入" />
      </div>

      <button type="button">outside</button>
    </>
  );
}

function setupHarness(): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{ schema: makeSchema() }}>
      <ShortcutHarness onReady={nextApi => {
        storeApi = nextApi;
      }}
      />
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
}

async function focusStage(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: "stage" }));
}

describe("useEditorShortcuts", () => {
  describe("Delete", () => {
    it("removes the selected node in edit mode", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().selectNode(FIELD_ID);
      });

      await focusStage(user);
      await user.keyboard("{Delete}");

      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeUndefined();
    });

    it("does not fire while typing in a text input", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().selectNode(FIELD_ID);
      });

      // The typing guard is the hook's reason to exist: a Delete keystroke
      // inside the properties panel edits text, never the canvas.
      await user.click(screen.getByRole("textbox", { name: "属性输入" }));
      await user.keyboard("{Delete}");

      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeDefined();
      expect(storeApi.getState().selectedId).toBe(FIELD_ID);
    });
  });

  describe("undo / redo", () => {
    it("undoes with Cmd+Z", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().removeNode(FIELD_ID);
      });
      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeUndefined();

      await focusStage(user);
      await user.keyboard("{Meta>}z{/Meta}");

      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeDefined();
    });

    it("redoes with Cmd+Shift+Z", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().removeNode(FIELD_ID);
        storeApi.getState().undo();
      });
      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeDefined();

      await focusStage(user);
      await user.keyboard("{Meta>}{Shift>}Z{/Shift}{/Meta}");

      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeUndefined();
    });

    it("redoes with Cmd+Y", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().removeNode(FIELD_ID);
        storeApi.getState().undo();
      });

      await focusStage(user);
      await user.keyboard("{Meta>}y{/Meta}");

      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeUndefined();
    });
  });

  describe("Cmd+D", () => {
    it("duplicates the selected node", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().selectNode(FIELD_ID);
      });

      await focusStage(user);
      await user.keyboard("{Meta>}d{/Meta}");

      const { children } = storeApi.getState().schema.presentations.pc;
      expect(children).toHaveLength(2);
    });

    it("prevents the browser default even with nothing selected", async () => {
      const user = userEvent.setup();
      setupHarness();

      let defaultPrevented = false;

      const observe = (event: KeyboardEvent): void => {
        ({ defaultPrevented } = event);
      };

      // The same event object bubbles on to the document, carrying the
      // preventDefault flag the shell handler set — without it Cmd+D opens the
      // browser's bookmark dialog whenever no node happens to be selected.
      document.addEventListener("keydown", observe);

      try {
        await focusStage(user);
        await user.keyboard("{Meta>}d{/Meta}");
      } finally {
        document.removeEventListener("keydown", observe);
      }

      expect(defaultPrevented).toBe(true);
    });
  });

  describe("Escape", () => {
    it("clears the selection", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().selectNode(FIELD_ID);
      });

      await focusStage(user);
      await user.keyboard("{Escape}");

      expect(storeApi.getState().selectedId).toBeNull();
    });
  });

  describe("containment", () => {
    it("ignores keystrokes whose focus is outside the editor shell", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().selectNode(FIELD_ID);
      });

      // Focus a control that is NOT inside the shell root: the shell-scoped
      // listener never sees the event, so another editor instance (or the host
      // page) keeps its own keys.
      await user.click(screen.getByRole("button", { name: "outside" }));
      await user.keyboard("{Delete}");

      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeDefined();
      expect(storeApi.getState().selectedId).toBe(FIELD_ID);
    });
  });

  describe("preview mode", () => {
    it("keeps the selection but ignores shortcuts", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().selectNode(FIELD_ID);
        storeApi.getState().setViewMode("preview");
      });

      // The selection survives the round trip (peeking at the preview must
      // not cost the designer their working selection)…
      expect(storeApi.getState().selectedId).toBe(FIELD_ID);

      await focusStage(user);
      await user.keyboard("{Delete}");

      // …but editing shortcuts stay inert while previewing.
      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeDefined();
    });
  });

  describe("json mode", () => {
    it("does not delete or duplicate the unseen selection", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().selectNode(FIELD_ID);
        storeApi.getState().setViewMode("json");
      });

      // The selection survives into JSON view but is not rendered there, so the
      // mutating shortcuts must not act on a node the designer cannot see.
      expect(storeApi.getState().selectedId).toBe(FIELD_ID);

      await focusStage(user);
      await user.keyboard("{Delete}");
      await user.keyboard("{Meta>}d{/Meta}");

      const { children } = storeApi.getState().schema.presentations.pc;
      expect(children).toHaveLength(1);
      expect(findNode(storeApi.getState().schema.presentations.pc, FIELD_ID)).toBeDefined();
    });

    it("still prevents the browser default for Cmd+D", async () => {
      const user = userEvent.setup();
      const storeApi = setupHarness();

      act(() => {
        storeApi.getState().setViewMode("json");
      });

      let defaultPrevented = false;

      const observe = (event: KeyboardEvent): void => {
        ({ defaultPrevented } = event);
      };

      document.addEventListener("keydown", observe);

      try {
        await focusStage(user);
        await user.keyboard("{Meta>}d{/Meta}");
      } finally {
        document.removeEventListener("keydown", observe);
      }

      expect(defaultPrevented).toBe(true);
    });
  });
});
