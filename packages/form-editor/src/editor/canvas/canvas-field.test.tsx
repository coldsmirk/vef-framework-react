import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema, TextfieldField } from "../../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DragDropProvider } from "@vef-framework-react/core";
import { describe, expect, it } from "vitest";

import { findNode } from "../../engine/schema/walk";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { CanvasField } from "./canvas-field";

const field: TextfieldField = {
  id: "Field_1",
  type: "textfield",
  key: "name",
  label: "文本框"
};

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: { children: [field] }
    }
  };
}

function setupField(): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  function Capture(): null {
    storeApi = useFormEditorStoreApi();
    return null;
  }

  render(
    <FormEditorStoreProvider initialState={{ schema: makeSchema() }}>
      <DragDropProvider>
        <Capture />

        <CanvasField block={field}>
          <div>字段内容</div>
        </CanvasField>
      </DragDropProvider>
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
}

/**
 * These specs target the selectable card wrapper — a structural element with no
 * accessible role, so reaching it requires DOM traversal; `data-canvas-field` is
 * the documented attribute. The preview inside is live, so a click on it bubbles
 * up to the wrapper to select the block.
 */
function cardOf(text: string): HTMLElement {
  const wrapper = screen.getByText(text).closest("[data-canvas-field]");

  if (!(wrapper instanceof HTMLElement)) {
    throw new TypeError("canvas field wrapper not found");
  }

  return wrapper;
}

describe("CanvasField", () => {
  it("makes the grip the drag handle, not the whole card", async () => {
    setupField();

    // dnd-kit promotes a draggable's *activator* (its `handle ?? element`, and
    // there is exactly one) into an accessible control: role=button +
    // aria-roledescription="draggable". Wiring `handleRef` to the grip makes the
    // grip that activator, so a drag starts only from the grip — not from
    // anywhere on the card. Reverting the handle wiring leaves the grip a plain
    // span (the card becomes the activator instead) and fails this query.
    const grip = await screen.findByRole("button", { name: "拖动排序" });
    await waitFor(() => expect(grip).toHaveAttribute("aria-roledescription", "draggable"));
  });

  it("selects the block when the card is clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupField();

    await user.click(cardOf("字段内容"));

    expect(storeApi.getState().selectedId).toBe(field.id);
  });

  it("duplicates the block from the toolbar button", async () => {
    const user = userEvent.setup();
    const storeApi = setupField();

    // The action bar is pointer-inert until the card is hovered or selected;
    // selecting first mirrors the real flow and unlocks the buttons.
    await user.click(cardOf("字段内容"));
    await user.click(screen.getByRole("button", { name: "复制" }));

    const { children } = storeApi.getState().schema.presentations.pc;
    expect(children).toHaveLength(2);
    expect(children[1]).toMatchObject({ type: "textfield", key: "name_2" });
  });

  it("removes the block from the toolbar button", async () => {
    const user = userEvent.setup();
    const storeApi = setupField();

    await user.click(cardOf("字段内容"));
    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(findNode(storeApi.getState().schema.presentations.pc, field.id)).toBeUndefined();
  });
});
