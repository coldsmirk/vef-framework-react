import type { RenderResult } from "@testing-library/react";

import type { Block, FormSchema } from "../../types";

import { render, screen } from "@testing-library/react";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider } from "../../store/form-store";
import { ContainerDragChip } from "./container-drag-chip";

const registry = createDefaultRegistry();

function schemaOf(children: Block[]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children } }
  };
}

function renderChip(nodeId: string, children: Block[]): RenderResult {
  return render(
    <FormEditorStoreProvider initialState={{ schema: schemaOf(children) }}>
      <RegistryProvider registries={{ pc: registry, mobile: registry }}>
        <ContainerDragChip nodeId={nodeId} />
      </RegistryProvider>
    </FormEditorStoreProvider>
  );
}

const section: Block = {
  id: "Sec_1",
  type: "section",
  variant: "card",
  title: "基本信息",
  children: []
};

const flex: Block = {
  id: "Flex_1",
  type: "flex",
  children: []
};

const leaf: Block = {
  id: "Field_1",
  type: "textfield",
  key: "a",
  label: "字段A"
};

describe("ContainerDragChip", () => {
  it("shows the container's own title", () => {
    renderChip("Sec_1", [section]);

    expect(screen.getByText("基本信息")).toBeInTheDocument();
  });

  it("falls back to the registry type name when the container has no title", () => {
    const flexName = registry.get("flex")?.config.name ?? "";
    renderChip("Flex_1", [flex]);

    expect(flexName).not.toBe("");
    expect(screen.getByText(flexName)).toBeInTheDocument();
  });

  it("renders nothing for an unknown node id", () => {
    const { container } = renderChip("missing", [section]);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a leaf field", () => {
    const { container } = renderChip("Field_1", [leaf]);

    expect(container).toBeEmptyDOMElement();
  });
});
