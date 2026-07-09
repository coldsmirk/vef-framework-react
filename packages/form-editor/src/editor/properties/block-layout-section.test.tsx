import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { Block, FormSchema } from "../../types";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { currentLayer } from "../../engine/schema/presentation";
import { findNode } from "../../engine/schema/walk";
import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { BlockLayoutSection } from "./block-layout-section";

const FIELD_ID = "Field_1";

function field(stack?: Block["stack"]): Block {
  return {
    id: FIELD_ID,
    type: "textfield",
    key: "a",
    label: "字段A",
    ...stack !== undefined && { stack }
  };
}

function schemaWith(block: Block): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: [block] } }
  };
}

/**
 * Renders the layout section against the LIVE store node (re-read on every
 * change), so a write round-trips back into the control exactly as the
 * properties panel drives it. `parent` is undefined — a root-level block, i.e.
 * the stack context this section serves.
 */
function Harness({ onReady }: { onReady: (api: FormEditorStoreApi) => void }): ReactElement | null {
  const api = useFormEditorStoreApi();
  const node = useFormEditorStore(s => findNode(currentLayer(s.schema, s.device), FIELD_ID));

  useEffect(() => onReady(api), [api, onReady]);

  return node ? <BlockLayoutSection node={node} parent={undefined} /> : null;
}

function setup(block: Block): FormEditorStoreApi {
  let api!: FormEditorStoreApi;

  render(
    <FormEditorStoreProvider initialState={{ schema: schemaWith(block) }}>
      <Harness
        onReady={ready => {
          api = ready;
        }}
      />
    </FormEditorStoreProvider>
  );

  return api;
}

function stackOf(api: FormEditorStoreApi): Block["stack"] {
  return api.getState().schema.presentations.pc?.children[0]?.stack;
}

describe("BlockLayoutSection", () => {
  describe("in a stack context", () => {
    it("renders width, min/max, and alignment controls", () => {
      setup(field());

      expect(screen.getByText("宽度")).toBeInTheDocument();
      expect(screen.getByText("最小宽度")).toBeInTheDocument();
      expect(screen.getByText("最大宽度")).toBeInTheDocument();
      expect(screen.getByText("水平对齐")).toBeInTheDocument();
      expect(screen.getAllByRole("spinbutton")).toHaveLength(3);
    });

    it("writes the entered width in pixels", async () => {
      const user = userEvent.setup();
      const api = setup(field());

      await user.type(screen.getAllByRole("spinbutton")[0] as HTMLElement, "500");

      expect(stackOf(api)).toEqual({ width: { value: 500, unit: "px" } });
    });

    it("clears the stack slot when the width is emptied", async () => {
      const user = userEvent.setup();
      const api = setup(field({ width: { value: 500, unit: "px" } }));

      await user.clear(screen.getAllByRole("spinbutton")[0] as HTMLElement);

      expect(stackOf(api)).toBeUndefined();
    });

    it("switches the width unit to percent", async () => {
      const user = userEvent.setup();
      const api = setup(field());

      const widthRow = screen.getByText("宽度").closest("div") as HTMLElement;
      await user.type(within(widthRow).getByRole("spinbutton"), "60");
      // antd hides the Segmented's radio input (pointer-events: none) behind its
      // label, so click the visible "%" segment label.
      await user.click(within(widthRow).getByText("%"));

      expect(stackOf(api)).toEqual({ width: { value: 60, unit: "%" } });
    });
  });
});
