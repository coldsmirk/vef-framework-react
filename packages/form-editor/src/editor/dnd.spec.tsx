import type { DragEndEvent } from "@vef-framework-react/core";
import type { ReactNode } from "react";

import type { FormEditorStoreApi } from "../store/form-store";
import type { TabsNode } from "../types";
import type { DropZoneData } from "./dnd";

import { act, renderHook } from "@testing-library/react";

import { textfieldDefinition } from "../components/textfield";
import { isKeyedField } from "../engine/keys";
import { createDefaultRegistry } from "../engine/registry/defaults";
import { walkFields } from "../engine/schema/walk";
import { RegistryProvider } from "../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../store/form-store";
import { dropZoneId, fallbackDropZoneId, useEditorDragEnd } from "./dnd";

const registry = createDefaultRegistry();

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return (
    <FormEditorStoreProvider initialState={{}}>
      <RegistryProvider registries={{ pc: registry, mobile: registry }}>{children}</RegistryProvider>
    </FormEditorStoreProvider>
  );
}

function setup(): { api: FormEditorStoreApi; dragEnd: (event: DragEndEvent) => void } {
  const { result } = renderHook(
    () => { return { api: useFormEditorStoreApi(), dragEnd: useEditorDragEnd() }; },
    { wrapper }
  );

  return result.current;
}

/**
 * Build a DragEndEvent with the given source/target `data`. Only the fields the
 * handler reads are populated.
 */
function dragEvent(source: unknown, target: unknown, canceled = false): DragEndEvent {
  return {
    canceled,
    operation: {
      source: source === null ? null : { data: source },
      target: target === null ? null : { data: target }
    }
  } as unknown as DragEndEvent;
}

function fieldIds(api: FormEditorStoreApi): string[] {
  const ids: string[] = [];

  walkFields(api.getState().schema.presentations.pc, (field, scope) => {
    if (scope.length === 0 && isKeyedField(field)) {
      ids.push(field.id);
    }
  });

  return ids;
}

describe("useEditorDragEnd", () => {
  it("inserts a new field when a palette item is dropped", () => {
    const { api, dragEnd } = setup();

    act(() => dragEnd(dragEvent({ kind: "palette", type: "textfield" }, { zone: "root" })));

    expect(fieldIds(api)).toHaveLength(1);
  });

  it("moves an existing block beside an anchor", () => {
    const { api, dragEnd } = setup();
    act(() => api.getState().insertField({ definition: textfieldDefinition }));
    act(() => api.getState().insertField({ definition: textfieldDefinition }));
    const [first = "", second = ""] = fieldIds(api);

    act(() => dragEnd(dragEvent(
      { kind: "block", nodeId: first },
      {
        zone: "beside",
        anchorId: second,
        side: "after"
      }
    )));

    expect(api.getState().schema.presentations.pc.children.map(block => block.id)).toEqual([second, first]);
  });

  it("appends into the tab selected by a container zone's tabIndex", () => {
    const { api, dragEnd } = setup();
    const tabs: TabsNode = {
      id: "Tabs_1",
      type: "tabs",
      tabs: [
        {
          id: "Tab_1",
          label: "一",
          children: []
        },
        {
          id: "Tab_2",
          label: "二",
          children: []
        }
      ]
    };
    act(() => api.getState().setSchema({
      id: "Form_1",
      version: 2,
      presentations: { pc: { children: [tabs] } }
    }));

    act(() => dragEnd(dragEvent(
      { kind: "palette", type: "textfield" },
      {
        zone: "container",
        containerId: "Tabs_1",
        tabIndex: 1
      }
    )));

    const next = api.getState().schema.presentations.pc.children[0] as TabsNode;
    const { children: firstTabChildren } = next.tabs[0] ?? { children: [] };
    const { children: secondTabChildren } = next.tabs[1] ?? { children: [] };
    expect(firstTabChildren).toHaveLength(0);
    expect(secondTabChildren).toHaveLength(1);
    expect(secondTabChildren[0]).toMatchObject({ type: "textfield" });
  });

  it("moves a block through a body fallback zone's append data", () => {
    const { api, dragEnd } = setup();
    act(() => api.getState().insertField({ definition: textfieldDefinition }));
    act(() => api.getState().insertField({ definition: textfieldDefinition }));
    const [first = "", second = ""] = fieldIds(api);

    // A drop that misses every precise zone lands on the body fallback, whose
    // data is the same append target — the handler reads only `target.data`.
    act(() => dragEnd(dragEvent({ kind: "block", nodeId: first }, { zone: "root" })));

    expect(api.getState().schema.presentations.pc.children.map(block => block.id)).toEqual([second, first]);
  });

  it("ignores a canceled drag", () => {
    const { api, dragEnd } = setup();

    act(() => dragEnd(dragEvent({ kind: "palette", type: "textfield" }, { zone: "root" }, true)));

    expect(fieldIds(api)).toHaveLength(0);
  });

  it("ignores a drag with no drop target", () => {
    const { api, dragEnd } = setup();

    act(() => dragEnd(dragEvent({ kind: "palette", type: "textfield" }, null)));

    expect(fieldIds(api)).toHaveLength(0);
  });

  it("ignores a palette type missing from the registry", () => {
    const { api, dragEnd } = setup();
    const before = api.getState();

    act(() => dragEnd(dragEvent({ kind: "palette", type: "not-registered" }, { zone: "root" })));

    expect(api.getState().schema).toBe(before.schema);
    expect(api.getState().past).toBe(before.past);
  });

  describe("malformed drag payloads", () => {
    it("rejects source data that is not EditorDragData", () => {
      const { api, dragEnd } = setup();

      act(() => dragEnd(dragEvent({ kind: "mystery" }, { zone: "root" })));
      act(() => dragEnd(dragEvent({ kind: "palette", type: 42 }, { zone: "root" })));
      act(() => dragEnd(dragEvent("palette", { zone: "root" })));
      act(() => dragEnd(dragEvent(null, { zone: "root" })));

      expect(fieldIds(api)).toHaveLength(0);
    });

    it("rejects target data that is not DropZoneData", () => {
      const { api, dragEnd } = setup();

      act(() => dragEnd(dragEvent({ kind: "palette", type: "textfield" }, { zone: "bogus" })));
      act(() => dragEnd(dragEvent({ kind: "palette", type: "textfield" }, {
        zone: "beside",
        anchorId: 9,
        side: "after"
      })));
      act(() => dragEnd(dragEvent({ kind: "palette", type: "textfield" }, { zone: "container" })));
      act(() => dragEnd(dragEvent({ kind: "palette", type: "textfield" }, "root")));

      expect(fieldIds(api)).toHaveLength(0);
    });
  });
});

describe("fallbackDropZoneId", () => {
  it("prefixes the precise zone id so a body fallback never collides with it", () => {
    const rootTail: DropZoneData = { zone: "root" };
    const container: DropZoneData = { zone: "container", containerId: "Sec_1" };

    expect(fallbackDropZoneId(rootTail)).toBe(`fallback-${dropZoneId(rootTail)}`);
    expect(fallbackDropZoneId(container)).toBe(`fallback-${dropZoneId(container)}`);
    expect(fallbackDropZoneId(rootTail)).not.toBe(dropZoneId(rootTail));
    expect(fallbackDropZoneId(container)).not.toBe(dropZoneId(container));
  });
});
