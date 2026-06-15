import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema, SubformNode } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { ContainerProperties } from "./container-properties";

const SUBFORM_ID = "Sub_1";

function subformNode(overrides: Partial<SubformNode> = {}): SubformNode {
  return {
    id: SUBFORM_ID,
    type: "subform",
    variant: "stack",
    key: "lines",
    label: "明细",
    template: [],
    ...overrides
  };
}

function makeSchema(subform: SubformNode): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: [subform] } }
  };
}

interface HarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

/**
 * Renders the subform node read live from the store so updateBlock commits
 * round-trip into the controls, as in the real panel.
 */
function Harness({ onReady }: HarnessProps): ReactElement | null {
  const api = useFormEditorStoreApi();
  const node = useFormEditorStore(state => state.schema.presentations.pc.children.find(block => block.id === SUBFORM_ID));

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  if (!node || node.type !== "subform") {
    return null;
  }

  return <ContainerProperties node={node} parent={undefined} onClose={vi.fn()} />;
}

function setup(subform: SubformNode): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{ schema: makeSchema(subform) }}>
      <Harness
        onReady={api => {
          captured = api;
        }}
      />
    </FormEditorStoreProvider>
  );

  if (!captured) {
    throw new Error("Form store API was not captured");
  }

  return captured;
}

function storeSubform(api: FormEditorStoreApi): SubformNode {
  const node = api.getState().schema.presentations.pc.children.find(block => block.id === SUBFORM_ID);

  if (!node || node.type !== "subform") {
    throw new Error("subform node missing from the store schema");
  }

  return node;
}

describe("ContainerProperties", () => {
  describe("subform", () => {
    it("shows the binding key read-only", () => {
      setup(subformNode());

      const keyInput = screen.getByDisplayValue("lines");
      expect(keyInput).toBeDisabled();
      expect(screen.getByText(/暂不支持在此修改/)).toBeInTheDocument();
    });

    it("clamps a minimum above the current maximum down to it", async () => {
      const user = userEvent.setup();
      const api = setup(subformNode({ maxRows: 5 }));

      // Spinbutton order mirrors the editor: 最少行数, then 最多行数.
      const [minRowsInput] = screen.getAllByRole("spinbutton");
      await user.type(minRowsInput as HTMLElement, "9");
      await user.tab();

      expect(storeSubform(api).minRows).toBe(5);
    });

    it("clamps a maximum below the current minimum up to it", async () => {
      const user = userEvent.setup();
      const api = setup(subformNode({ minRows: 4 }));

      const [, maxRowsInput] = screen.getAllByRole("spinbutton");
      await user.type(maxRowsInput as HTMLElement, "2");
      await user.tab();

      expect(storeSubform(api).maxRows).toBe(4);
    });

    it("renders the container linkage section", () => {
      setup(subformNode());

      expect(screen.getByText("联动规则")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /新建联动规则/ })).toBeInTheDocument();
    });
  });
});
