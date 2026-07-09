import type { ReactNode } from "react";

import type { Block, FieldLinkageRule, FormSchema, SectionNode, SubformNode, TextfieldField } from "../types";
import type { FormEditorStoreApi } from "./form-store";

import { act, renderHook } from "@testing-library/react";

import { sectionDefinition } from "../components/containers";
import { textfieldDefinition } from "../components/textfield";
import { isKeyedField } from "../engine/keys";
import { createDefaultRegistry } from "../engine/registry/defaults";
import { createDefaultMobileRegistry } from "../engine/registry/defaults-mobile";
import { validateSchema } from "../engine/schema/validate";
import { findField, findNode, findScope, walkFields } from "../engine/schema/walk";
import { FormEditorStoreProvider, isPaletteVisible, selectFieldCount, useFormEditorStoreApi } from "./form-store";

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <FormEditorStoreProvider initialState={{}}>{children}</FormEditorStoreProvider>;
}

function setup(): FormEditorStoreApi {
  return renderHook(() => useFormEditorStoreApi(), { wrapper }).result.current;
}

function rootKeys(schema: FormSchema): string[] {
  const keys: string[] = [];

  walkFields(schema.presentations.pc, (field, scope) => {
    if (scope.length === 0 && isKeyedField(field)) {
      keys.push(field.key);
    }
  });

  return keys;
}

function keyOf(schema: FormSchema, fieldId: string): string | undefined {
  const field = findNode(schema.presentations.pc, fieldId);

  return field && "key" in field ? field.key : undefined;
}

function tf(id: string, key: string, extra: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id,
    type: "textfield",
    key,
    ...extra
  };
}

function conditionRule(id: string, sourceKey: string): FieldLinkageRule {
  return {
    id,
    trigger: {
      kind: "condition",
      condition: {
        kind: "leaf",
        sourceKey,
        operator: "empty"
      }
    },
    actions: [{ type: "hide" }]
  };
}

function schemaOf(children: Block[], extra: Partial<FormSchema> = {}): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children } },
    ...extra
  };
}

function variablesSchema(): FormSchema {
  return schemaOf(
    [
      tf("fa", "amount", {
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: { kind: "change" },
              actions: [
                {
                  type: "set_variable",
                  variable: "count",
                  value: { kind: "literal", value: 1 }
                }
              ]
            }
          ]
        }
      })
    ],
    {
      variables: [
        {
          id: "Var_1",
          name: "count",
          type: "number"
        },
        {
          id: "Var_2",
          name: "other",
          type: "string"
        }
      ]
    }
  );
}

function dataSourceSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    dataSources: [
      {
        id: "ds1",
        name: "Cities",
        kind: "static",
        options: [{ label: "A", value: "a" }]
      }
    ],
    presentations: {
      pc: {
        children: [
          {
            id: "f1",
            type: "select",
            key: "city",
            dataSource: { kind: "ref", dataSourceId: "ds1" }
          },
          tf("f2", "note", {
            linkage: {
              rules: [
                {
                  id: "r1",
                  trigger: { kind: "change" },
                  actions: [{ type: "refresh_data_source", dataSourceId: "ds1" }]
                }
              ]
            }
          })
        ]
      }
    }
  };
}

describe("form store", () => {
  describe("insertField", () => {
    it("mints a unique key per inserted field of the same type", () => {
      const api = setup();

      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      act(() => api.getState().insertField({ definition: textfieldDefinition }));

      expect(rootKeys(api.getState().schema)).toEqual(["textfield", "textfield_2"]);
    });

    it("selects the newly inserted field", () => {
      const api = setup();

      act(() => api.getState().insertField({ definition: textfieldDefinition }));

      const { selectedId } = api.getState();
      expect(selectedId).not.toBeNull();
      expect(findNode(api.getState().schema.presentations.pc, selectedId ?? "")).toBeDefined();
    });

    it("mints validator-clean keys for every built-in keyed definition", () => {
      // Regression: hyphenated type discriminators (code-editor,
      // checkbox-group) used to mint keys the validator rejects with
      // key_invalid_charset, so the editor's own output failed import.
      const api = setup();
      const registry = createDefaultRegistry();
      const keyed = registry.list().filter(definition => definition.config.keyed);

      for (const definition of keyed) {
        act(() => api.getState().insertField({ definition }));
      }

      const result = validateSchema(api.getState().schema, {
        pc: registry,
        mobile: createDefaultMobileRegistry()
      });
      expect(result.issues).toEqual([]);
    });

    it("leaves schema, history, and selection untouched on a stale drop anchor", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const before = api.getState();

      act(() => api.getState().insertField({
        definition: textfieldDefinition,
        target: {
          kind: "beside",
          anchorId: "ghost",
          side: "after"
        }
      }));

      // The engine op reported a no-op (same layer reference): no junk history
      // entry, and no selection of an id that never landed in the tree.
      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
      expect(api.getState().selectedId).toBe(before.selectedId);
    });
  });

  describe("duplicateNode", () => {
    it("inserts a clone with a fresh id and unique key", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const sourceId = api.getState().selectedId as string;

      act(() => api.getState().duplicateNode(sourceId));

      const keys = rootKeys(api.getState().schema);
      expect(keys).toEqual(["textfield", "textfield_2"]);
      expect(api.getState().selectedId).not.toBe(sourceId);
    });

    it("duplicates a container with its body, re-keying the nested fields", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: sectionDefinition }));
      const section = api.getState().schema.presentations.pc.children[0] as SectionNode;

      act(() => api.getState().insertField({
        definition: textfieldDefinition,
        target: { kind: "container", containerId: section.id }
      }));
      act(() => api.getState().duplicateNode(section.id));

      const { children } = api.getState().schema.presentations.pc;
      expect(children).toHaveLength(2);

      const clone = children[1] as SectionNode;
      expect(clone.type).toBe("section");
      expect(clone.id).not.toBe(section.id);
      // A section keeps the enclosing value scope, so the cloned field's key is
      // de-duplicated against the original.
      expect(clone.children[0]).toMatchObject({ type: "textfield", key: "textfield_2" });
      expect(api.getState().selectedId).toBe(clone.id);
    });
  });

  describe("removeNode", () => {
    it("clears a selection that lived inside the removed container", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: sectionDefinition }));
      const section = api.getState().schema.presentations.pc.children[0] as SectionNode;

      act(() => api.getState().insertField({
        definition: textfieldDefinition,
        target: { kind: "container", containerId: section.id }
      }));
      // The field inside the section is now selected.
      const fieldId = api.getState().selectedId as string;
      expect(findNode(api.getState().schema.presentations.pc, fieldId)).toBeDefined();

      act(() => api.getState().removeNode(section.id));

      expect(api.getState().selectedId).toBeNull();
    });

    it("prunes a sibling rule that referenced the removed field's key", () => {
      const api = setup();
      const nextSchema = schemaOf([
        tf("fa", "amount"),
        tf("fb", "note", { linkage: { rules: [conditionRule("r1", "amount")] } })
      ]);

      act(() => api.getState().setSchema(nextSchema));

      act(() => api.getState().removeNode("fa"));

      const watcher = findField(api.getState().schema.presentations.pc, "fb");
      expect(watcher?.linkage?.rules).toEqual([]);
    });

    it("prunes the form-level linkage when a root-scope pc key dies", () => {
      const api = setup();
      act(() => api.getState().setSchema(schemaOf(
        [tf("fa", "amount"), tf("fb", "note")],
        {
          linkage: {
            rules: [
              {
                id: "form-r1",
                trigger: { kind: "load" },
                actions: [
                  {
                    type: "set_field",
                    targetKey: "amount",
                    value: { kind: "literal", value: 1 }
                  }
                ]
              }
            ]
          }
        }
      )));

      act(() => api.getState().removeNode("fa"));

      expect(api.getState().schema.linkage?.rules).toEqual([]);
    });

    it("leaves a duplicated subform's internal rules untouched when the original's field is removed", () => {
      const api = setup();
      const subform: SubformNode = {
        id: "sf",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [
          tf("fc", "amount"),
          tf("fd", "note", { linkage: { rules: [conditionRule("r2", "amount")] } })
        ]
      };
      act(() => api.getState().setSchema(schemaOf([subform])));
      act(() => api.getState().duplicateNode("sf"));

      act(() => api.getState().removeNode("fc"));

      const original = api.getState().schema.presentations.pc.children[0] as SubformNode;
      const clone = api.getState().schema.presentations.pc.children[1] as SubformNode;
      // The original's watcher lost its source and was pruned…
      expect(original.template).toHaveLength(1);
      expect(original.template[0]?.linkage?.rules).toEqual([]);
      // …while the clone's template is its own value scope: still intact.
      expect(clone.key).toBe("lines_2");
      expect(clone.template).toHaveLength(2);
      expect(clone.template[1]?.linkage?.rules).toHaveLength(1);
    });

    it("restores the pruned references together with the node on undo", () => {
      const api = setup();
      const nextSchema = schemaOf([
        tf("fa", "amount"),
        tf("fb", "note", { linkage: { rules: [conditionRule("r1", "amount")] } })
      ]);

      act(() => api.getState().setSchema(nextSchema));

      act(() => api.getState().removeNode("fa"));
      act(() => api.getState().undo());

      expect(findNode(api.getState().schema.presentations.pc, "fa")).toBeDefined();
      expect(findField(api.getState().schema.presentations.pc, "fb")?.linkage?.rules).toHaveLength(1);
    });
  });

  describe("moveNode", () => {
    it("supports undoing a move", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const [first, second] = api.getState().schema.presentations.pc.children.map(block => block.id);

      act(() => api.getState().moveNode({
        nodeId: first ?? "",
        target: {
          kind: "beside",
          anchorId: second ?? "",
          side: "after"
        }
      }));
      expect(api.getState().schema.presentations.pc.children.map(block => block.id)).toEqual([second, first]);

      act(() => api.getState().undo());

      expect(api.getState().schema.presentations.pc.children.map(block => block.id)).toEqual([first, second]);
    });

    it("selects the moved node", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const [first, second] = api.getState().schema.presentations.pc.children.map(block => block.id);

      // The second insert left the selection on `second`; moving `first` must
      // hand the selection to the node that was just placed.
      act(() => api.getState().moveNode({
        nodeId: first ?? "",
        target: {
          kind: "beside",
          anchorId: second ?? "",
          side: "after"
        }
      }));

      expect(api.getState().selectedId).toBe(first);
    });

    it("pushes no history entry for a self-drop", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const nodeId = api.getState().selectedId as string;
      const before = api.getState();

      act(() => api.getState().moveNode({
        nodeId,
        target: {
          kind: "beside",
          anchorId: nodeId,
          side: "before"
        }
      }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });

    it("prunes a template rule when its source field moves out of the subform scope", () => {
      const api = setup();
      const subform: SubformNode = {
        id: "sf",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [
          tf("ta", "amount"),
          tf("tb", "note", { linkage: { rules: [conditionRule("r1", "amount")] } })
        ]
      };
      act(() => api.getState().setSchema(schemaOf([subform])));

      act(() => api.getState().moveNode({
        nodeId: "ta",
        target: {
          kind: "beside",
          anchorId: "sf",
          side: "after"
        }
      }));

      // The field now lives at the root scope, and the template watcher that
      // read its key inside the subform scope lost its source — same prune as
      // a removal.
      expect(findScope(api.getState().schema.presentations.pc, "ta")).toEqual([]);
      expect(findField(api.getState().schema.presentations.pc, "tb")?.linkage?.rules).toEqual([]);
    });

    it("prunes the form-level linkage when a root key moves into a subform scope", () => {
      const api = setup();
      const subform: SubformNode = {
        id: "sf",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: []
      };
      act(() => api.getState().setSchema(schemaOf(
        [tf("fa", "amount"), subform],
        {
          linkage: {
            rules: [
              {
                id: "form-r1",
                trigger: { kind: "load" },
                actions: [
                  {
                    type: "set_field",
                    targetKey: "amount",
                    value: { kind: "literal", value: 1 }
                  }
                ]
              }
            ]
          }
        }
      )));

      act(() => api.getState().moveNode({
        nodeId: "fa",
        target: { kind: "container", containerId: "sf" }
      }));

      expect(api.getState().schema.linkage?.rules).toEqual([]);
    });

    it("keeps sibling rules when the move stays inside one scope", () => {
      const api = setup();
      const nextSchema = schemaOf([
        tf("fa", "amount"),
        tf("fb", "note", { linkage: { rules: [conditionRule("r1", "amount")] } })
      ]);

      act(() => api.getState().setSchema(nextSchema));

      act(() => api.getState().moveNode({
        nodeId: "fa",
        target: {
          kind: "beside",
          anchorId: "fb",
          side: "after"
        }
      }));

      expect(findField(api.getState().schema.presentations.pc, "fb")?.linkage?.rules).toHaveLength(1);
    });
  });

  describe("setSpan / setFlex", () => {
    it("pushes no history entry when the normalized span is already in place", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const nodeId = api.getState().selectedId as string;
      act(() => api.getState().setSpan({ nodeId, span: 12 }));
      const before = api.getState();

      // 12.4 normalizes (floors) to the 12 already in place — the op reports
      // identity, so no entry lands.
      act(() => api.getState().setSpan({ nodeId, span: 12.4 }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });

    it("pushes no history entry for a stale node id", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const before = api.getState();

      act(() => api.getState().setSpan({ nodeId: "ghost", span: 6 }));
      act(() => api.getState().setFlex({ nodeId: "ghost", flex: { grow: 1 } }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });
  });

  describe("setColumnWidth", () => {
    it("writes a fixed column width and records a checkpoint", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const nodeId = api.getState().selectedId as string;
      const before = api.getState();

      act(() => api.getState().setColumnWidth({ nodeId, width: 200 }));

      expect(api.getState().schema.presentations.pc?.children[0]?.columnWidth).toBe(200);
      expect(api.getState().past).not.toBe(before.past);
    });

    it("pushes no history entry when the normalized width is already in place", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const nodeId = api.getState().selectedId as string;
      act(() => api.getState().setColumnWidth({ nodeId, width: 200 }));
      const before = api.getState();

      // 200.4 floors to the 200 already in place — the op reports identity.
      act(() => api.getState().setColumnWidth({ nodeId, width: 200.4 }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });

    it("pushes no history entry for a stale node id", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const before = api.getState();

      act(() => api.getState().setColumnWidth({ nodeId: "ghost", width: 200 }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });
  });

  describe("setStackSlot", () => {
    it("writes stack sizing and records a checkpoint", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const nodeId = api.getState().selectedId as string;
      const before = api.getState();

      act(() => api.getState().setStackSlot({ nodeId, slot: { width: { value: 500, unit: "px" }, align: "center" } }));

      expect(api.getState().schema.presentations.pc?.children[0]?.stack).toEqual({
        width: { value: 500, unit: "px" },
        align: "center"
      });
      expect(api.getState().past).not.toBe(before.past);
    });

    it("pushes no history entry when the normalized slot is already in place", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const nodeId = api.getState().selectedId as string;
      act(() => api.getState().setStackSlot({ nodeId, slot: { width: { value: 500, unit: "px" } } }));
      const before = api.getState();

      // The same slot value normalizes to the one already in place — the op
      // reports identity, so no entry lands.
      act(() => api.getState().setStackSlot({ nodeId, slot: { width: { value: 500, unit: "px" } } }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });

    it("pushes no history entry for a stale node id", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const before = api.getState();

      act(() => api.getState().setStackSlot({ nodeId: "ghost", slot: { width: { value: 500, unit: "px" } } }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });
  });

  describe("editField / updateBlock", () => {
    it("pushes no history entry when the updater returns its input", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId as string;
      const before = api.getState();

      act(() => api.getState().editField({ fieldId, updater: field => field }));
      act(() => api.getState().updateBlock({ nodeId: fieldId, updater: node => node }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });

    it("pushes no history entry for a stale field id", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const before = api.getState();

      act(() => api.getState().editField({
        fieldId: "ghost",
        updater: field => {
          return { ...field, label: "X" };
        }
      }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });
  });

  describe("undo / redo", () => {
    it("restores the prior schema and round-trips through redo", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      // The timeline snapshots whole schemas, so redo restores the exact
      // post-insert schema reference.
      const afterInsert = api.getState().schema;

      act(() => api.getState().undo());
      expect(rootKeys(api.getState().schema)).toEqual([]);
      expect(api.getState().canRedo()).toBe(true);

      act(() => api.getState().redo());
      expect(api.getState().schema).toBe(afterInsert);
    });

    it("restores the cleared schema through undo", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const beforeClear = api.getState().schema;

      // clearSchema is an ordinary checkpointed edit — unlike setSchema (a
      // document swap that resets the timeline), the confirm dialog promises
      // the clear is recoverable.
      act(() => api.getState().clearSchema());
      expect(rootKeys(api.getState().schema)).toEqual([]);
      expect(api.getState().selectedId).toBeNull();
      expect(api.getState().canUndo()).toBe(true);

      act(() => api.getState().undo());
      expect(api.getState().schema).toBe(beforeClear);
    });

    it("undoes and redoes a form-level metadata edit (variables)", () => {
      const api = setup();

      act(() => api.getState().patchSchema({
        variables: [
          {
            id: "Var_1",
            name: "total",
            type: "number"
          }
        ]
      }));
      expect(api.getState().schema.variables).toHaveLength(1);

      // Form variables live on the schema envelope, not the presentation layer;
      // the whole-schema snapshot reverts them like any other edit.
      act(() => api.getState().undo());
      expect(api.getState().schema.variables).toBeUndefined();

      act(() => api.getState().redo());
      expect(api.getState().schema.variables).toEqual([
        {
          id: "Var_1",
          name: "total",
          type: "number"
        }
      ]);
    });

    it("never clobbers state from another device: each undo reverts exactly one change", () => {
      // The old per-device history snapshotted shared metadata into each
      // device's stack, so undoing a pc structural edit wholesale-restored a
      // stale snapshot and silently wiped variables added while on mobile.
      // The global timeline reverts strictly one change per undo, newest
      // first, jumping the view to the device the change happened on.
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId as string;

      act(() => api.getState().setDevice("mobile"));
      act(() => api.getState().patchSchema({
        variables: [
          {
            id: "Var_1",
            name: "total",
            type: "number"
          }
        ]
      }));
      act(() => api.getState().setDevice("pc"));

      // Undo #1 reverts the variable patch (the newest change) — the pc field
      // inserted earlier SURVIVES (the old design dropped it here), and the
      // view jumps to mobile, where the reverted change was made.
      act(() => api.getState().undo());
      expect(findNode(api.getState().schema.presentations.pc, fieldId)).toBeDefined();
      expect(api.getState().schema.variables).toBeUndefined();
      expect(api.getState().device).toBe("mobile");

      // Undo #2 reverts the insert, jumping back to pc.
      act(() => api.getState().undo());
      expect(findNode(api.getState().schema.presentations.pc, fieldId)).toBeUndefined();
      expect(api.getState().device).toBe("pc");

      // Redo replays both changes in order, restoring field AND variable.
      act(() => api.getState().redo());
      act(() => api.getState().redo());
      expect(findNode(api.getState().schema.presentations.pc, fieldId)).toBeDefined();
      expect(api.getState().schema.variables).toHaveLength(1);
    });

    it("trims the oldest entries beyond the history limit", () => {
      const api = setup();

      // HISTORY_LIMIT is 100; 105 checkpointed edits keep only the newest 100.
      for (let index = 0; index < 105; index += 1) {
        act(() => api.getState().insertField({ definition: textfieldDefinition }));
      }

      expect(api.getState().past).toHaveLength(100);
    });
  });

  describe("history coalescing", () => {
    it("folds consecutive edits to one field into a single undo step", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId as string;
      const pastAfterInsert = api.getState().past.length;

      act(() => api.getState().editField({
        fieldId,
        updater: field => { return { ...field, label: "A" }; }
      }));
      act(() => api.getState().editField({
        fieldId,
        updater: field => { return { ...field, label: "AB" }; }
      }));

      // Two edits to the same field share one history entry.
      expect(api.getState().past).toHaveLength(pastAfterInsert + 1);

      act(() => api.getState().undo());
      // A single undo reverts the whole edit run back to the inserted state.
      const field = findNode(api.getState().schema.presentations.pc, fieldId);
      expect(field && "label" in field ? field.label : undefined).toBe("文本框");
    });

    it("starts a fresh undo entry after a selection change between edits", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId as string;
      const base = api.getState().past.length;

      act(() => api.getState().editField({
        fieldId,
        updater: field => { return { ...field, label: "A" }; }
      }));
      act(() => api.getState().selectNode(fieldId));
      act(() => api.getState().editField({
        fieldId,
        updater: field => { return { ...field, label: "AB" }; }
      }));

      // The intervening selection breaks coalescing, so the two edits are two
      // distinct undoable steps.
      expect(api.getState().past).toHaveLength(base + 2);
    });

    it("keeps edits to different properties separate via the coalesceKey option", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId as string;
      const base = api.getState().past.length;

      act(() => api.getState().editField(
        {
          fieldId,
          updater: field => { return { ...field, label: "A" }; }
        },
        { coalesceKey: `field:${fieldId}:label` }
      ));
      act(() => api.getState().editField(
        {
          fieldId,
          updater: field => { return { ...field, label: "AB" }; }
        },
        { coalesceKey: `field:${fieldId}:label` }
      ));
      act(() => api.getState().editField(
        {
          fieldId,
          updater: field => { return { ...field, placeholder: "hint" }; }
        },
        { coalesceKey: `field:${fieldId}:placeholder` }
      ));

      // Label keystrokes fold into one step; the placeholder edit starts its own.
      expect(api.getState().past).toHaveLength(base + 2);
    });

    it("breaks a coalescing run on a view-mode round trip", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId as string;
      const base = api.getState().past.length;

      act(() => api.getState().editField({
        fieldId,
        updater: field => { return { ...field, label: "A" }; }
      }));
      act(() => api.getState().setViewMode("json"));
      act(() => api.getState().setViewMode("edit"));
      act(() => api.getState().editField({
        fieldId,
        updater: field => { return { ...field, label: "AB" }; }
      }));

      expect(api.getState().past).toHaveLength(base + 2);
    });
  });

  describe("setFieldKey", () => {
    it("sanitizes characters reserved by the value-path machinery", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId as string;

      act(() => api.getState().setFieldKey({ fieldId, key: "a.b[c]/d" }));

      expect(keyOf(api.getState().schema, fieldId)).toBe("abcd");
    });

    it("keeps the current key when the input sanitizes to empty", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId as string;

      act(() => api.getState().setFieldKey({ fieldId, key: "中文!!!" }));

      expect(keyOf(api.getState().schema, fieldId)).toBe("textfield");
    });

    it("de-duplicates a key that collides with another field in the scope", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const firstId = api.getState().selectedId as string;
      act(() => api.getState().setFieldKey({ fieldId: firstId, key: "amount" }));
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const secondId = api.getState().selectedId as string;

      // first is "amount", second is "textfield"; renaming the second to
      // "amount" de-duplicates to "amount_2" instead of colliding.
      act(() => api.getState().setFieldKey({ fieldId: secondId, key: "amount" }));

      expect(keyOf(api.getState().schema, secondId)).toBe("amount_2");
    });

    it("rewrites sibling rules and the form linkage to follow a root-scope rename", () => {
      const api = setup();
      const fields = [
        tf("fa", "amount"),
        tf("fb", "note", { linkage: { rules: [conditionRule("r1", "amount")] } })
      ];
      const nextSchema = schemaOf(
        fields,
        {
          linkage: {
            rules: [
              {
                id: "form-r1",
                trigger: { kind: "load" },
                actions: [
                  {
                    type: "set_field",
                    targetKey: "amount",
                    value: { kind: "literal", value: 1 }
                  }
                ]
              }
            ]
          }
        }
      );

      act(() => api.getState().setSchema(nextSchema));

      act(() => api.getState().setFieldKey({ fieldId: "fa", key: "total" }));

      const watcher = findField(api.getState().schema.presentations.pc, "fb");
      expect(watcher?.linkage?.rules?.[0]?.trigger).toMatchObject({
        condition: { sourceKey: "total" }
      });
      expect(api.getState().schema.linkage?.rules?.[0]?.actions[0]).toMatchObject({ targetKey: "total" });
    });

    it("does not touch the form linkage when a mobile key is renamed", () => {
      const api = setup();
      const formLinkage = { rules: [conditionRule("form-r1", "amount")] };
      act(() => api.getState().setSchema({
        id: "Form_1",
        version: 2,
        linkage: formLinkage,
        presentations: {
          pc: { children: [tf("fa", "amount")] },
          mobile: { children: [tf("m1", "amount")] }
        }
      }));
      act(() => api.getState().setDevice("mobile"));

      act(() => api.getState().setFieldKey({ fieldId: "m1", key: "price" }));

      // The form linkage resolves against the PC root scope — the mobile tree
      // is a separate key namespace and never reconciles it.
      expect(api.getState().schema.linkage).toBe(formLinkage);
      expect(keyOf(api.getState().schema, "fa")).toBe("amount");
    });
  });

  describe("renameVariable", () => {
    it("renames the declaration and rewrites set_variable actions", () => {
      const api = setup();
      act(() => api.getState().setSchema(variablesSchema()));

      act(() => api.getState().renameVariable("count", "total"));

      expect(api.getState().schema.variables?.map(variable => variable.name)).toEqual(["total", "other"]);
      const action = findField(api.getState().schema.presentations.pc, "fa")?.linkage?.rules?.[0]?.actions[0];
      expect(action).toMatchObject({ type: "set_variable", variable: "total" });
    });

    it("is a single undo step", () => {
      const api = setup();
      act(() => api.getState().setSchema(variablesSchema()));

      act(() => api.getState().renameVariable("count", "total"));
      act(() => api.getState().undo());

      expect(api.getState().schema.variables?.[0]?.name).toBe("count");
      const action = findField(api.getState().schema.presentations.pc, "fa")?.linkage?.rules?.[0]?.actions[0];
      expect(action).toMatchObject({ variable: "count" });
    });

    it("no-ops on an invalid identifier, a collision, or an unknown name", () => {
      const api = setup();
      act(() => api.getState().setSchema(variablesSchema()));
      const before = api.getState();

      act(() => api.getState().renameVariable("count", "not valid"));
      act(() => api.getState().renameVariable("count", "other"));
      act(() => api.getState().renameVariable("ghost", "fresh"));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });
  });

  describe("removeVariable", () => {
    it("removes the declaration but leaves set_variable actions intact", () => {
      const api = setup();
      act(() => api.getState().setSchema(schemaOf(
        [
          tf("fa", "amount", {
            linkage: {
              rules: [
                {
                  id: "r1",
                  trigger: { kind: "change" },
                  actions: [
                    {
                      type: "set_variable",
                      variable: "count",
                      value: { kind: "literal", value: 1 }
                    }
                  ]
                }
              ]
            }
          })
        ],
        {
          variables: [
            {
              id: "Var_1",
              name: "count",
              type: "number"
            }
          ]
        }
      )));

      act(() => api.getState().removeVariable("count"));

      // A set_variable to an undeclared name stays semantically valid at
      // runtime, so only the declaration goes; the emptied collection drops
      // its key entirely.
      expect(api.getState().schema.variables).toBeUndefined();
      const action = findField(api.getState().schema.presentations.pc, "fa")?.linkage?.rules?.[0]?.actions[0];
      expect(action).toMatchObject({ type: "set_variable", variable: "count" });
    });

    it("no-ops when the name is not declared", () => {
      const api = setup();
      const before = api.getState();

      act(() => api.getState().removeVariable("ghost"));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });
  });

  describe("removeDataSource", () => {
    it("removes the declaration and prunes field refs and refresh actions", () => {
      const api = setup();
      act(() => api.getState().setSchema(dataSourceSchema()));

      act(() => api.getState().removeDataSource("ds1"));

      expect(api.getState().schema.dataSources).toBeUndefined();

      const field = findField(api.getState().schema.presentations.pc, "f1");
      expect(field && "dataSource" in field).toBe(false);
      expect(findField(api.getState().schema.presentations.pc, "f2")?.linkage?.rules).toEqual([]);
    });

    it("restores everything in a single undo step", () => {
      const api = setup();
      act(() => api.getState().setSchema(dataSourceSchema()));

      act(() => api.getState().removeDataSource("ds1"));
      act(() => api.getState().undo());

      expect(api.getState().schema.dataSources).toHaveLength(1);
      const field = findField(api.getState().schema.presentations.pc, "f1");
      expect(field && "dataSource" in field).toBe(true);
      expect(findField(api.getState().schema.presentations.pc, "f2")?.linkage?.rules).toHaveLength(1);
    });

    it("no-ops when the id is not declared", () => {
      const api = setup();
      const before = api.getState();

      act(() => api.getState().removeDataSource("ghost"));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });
  });

  describe("mobile seeding", () => {
    it("returns to the no-mobile seed state when initMobile is undone", () => {
      const api = setup();
      act(() => api.getState().setDevice("mobile"));

      act(() => api.getState().initMobile({ children: [] }));
      expect(api.getState().schema.presentations.mobile).toBeDefined();
      expect(api.getState().device).toBe("mobile");

      act(() => api.getState().undo());

      // initMobile is an ordinary checkpointed mutation: a single undo removes
      // the seeded presentation, bringing the seed screen back.
      expect(api.getState().schema.presentations.mobile).toBeUndefined();
      expect(api.getState().device).toBe("mobile");
    });

    it("materializes the mobile layer on a first insert and undoes back to the seed state", () => {
      const api = setup();
      act(() => api.getState().setDevice("mobile"));

      // A palette double-click append on an undesigned mobile device.
      act(() => api.getState().insertField({ definition: textfieldDefinition }));

      const { children } = api.getState().schema.presentations.mobile ?? { children: [] };
      expect(children).toHaveLength(1);

      act(() => api.getState().undo());

      // One undo removes both the field and the materialized layer, so the
      // convert-from-PC offer is back instead of a permanently-empty layer.
      expect(api.getState().schema.presentations.mobile).toBeUndefined();
      expect(api.getState().device).toBe("mobile");
    });
  });

  describe("setDevice", () => {
    it("clears a selection that does not resolve in the new device's tree", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      expect(api.getState().selectedId).not.toBeNull();

      act(() => api.getState().setDevice("mobile"));

      expect(api.getState().selectedId).toBeNull();
    });

    it("keeps a selection whose id also exists in the new device's tree", () => {
      const api = setup();
      act(() => api.getState().setSchema({
        id: "Form_1",
        version: 2,
        presentations: {
          pc: { children: [tf("shared", "a")] },
          mobile: { children: [tf("shared", "a")] }
        }
      }));
      act(() => api.getState().selectNode("shared"));

      act(() => api.getState().setDevice("mobile"));

      expect(api.getState().selectedId).toBe("shared");
    });
  });

  describe("patchSchema", () => {
    it("routes gap to the active device's presentation layer", () => {
      const api = setup();

      act(() => api.getState().patchSchema({ gap: "large" }));

      expect(api.getState().schema.presentations.pc.gap).toBe("large");

      act(() => api.getState().patchSchema({ gap: undefined }));

      expect("gap" in api.getState().schema.presentations.pc).toBe(false);
    });

    it("routes gap to the mobile layer when editing mobile", () => {
      const api = setup();
      act(() => api.getState().setDevice("mobile"));
      act(() => api.getState().initMobile({ children: [] }));

      act(() => api.getState().patchSchema({ gap: "small" }));

      expect(api.getState().schema.presentations.mobile?.gap).toBe("small");
      expect(api.getState().schema.presentations.pc.gap).toBeUndefined();
    });

    it("pushes no history entry when the patch changes nothing", () => {
      const api = setup();
      act(() => api.getState().patchSchema({ gap: "large" }));
      const before = api.getState();

      // Re-applying the gap already in place and the id already set are both
      // no-ops: no undo entry, no fresh schema identity.
      act(() => api.getState().patchSchema({ gap: "large" }));
      act(() => api.getState().patchSchema({ id: before.schema.id }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });
  });

  describe("selectFieldCount", () => {
    it("counts the active device's leaf fields and tracks edits", () => {
      const api = setup();
      expect(selectFieldCount(api.getState())).toBe(0);

      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      act(() => api.getState().insertField({ definition: textfieldDefinition }));

      expect(selectFieldCount(api.getState())).toBe(2);
      // Re-reads against the same layer hit the identity memo and stay correct.
      expect(selectFieldCount(api.getState())).toBe(2);

      act(() => api.getState().setDevice("mobile"));

      // An undesigned mobile resolves to the shared empty layer.
      expect(selectFieldCount(api.getState())).toBe(0);
    });
  });

  describe("view modes", () => {
    it("hides editor chrome when switching to json mode", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));

      act(() => api.getState().setViewMode("json"));

      expect(isPaletteVisible(api.getState())).toBe(false);
    });

    it("keeps the selection across a view-mode round trip", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const selected = api.getState().selectedId;
      expect(selected).not.toBeNull();

      act(() => api.getState().setViewMode("json"));
      act(() => api.getState().setViewMode("edit"));

      expect(api.getState().selectedId).toBe(selected);
    });

    it("collapses the form-config drawer when leaving edit mode", () => {
      const api = setup();
      act(() => api.getState().setFormConfigTab("variables"));
      expect(api.getState().formConfigOpen).toBe(true);

      act(() => api.getState().setViewMode("preview"));

      expect(api.getState().formConfigOpen).toBe(false);
    });
  });

  describe("control selection", () => {
    it("clears the selection on selectNode(null)", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      expect(api.getState().selectedId).not.toBeNull();

      act(() => api.getState().selectNode(null));

      expect(api.getState().selectedId).toBeNull();
    });

    it("leaves the selection untouched when a form-level patch is applied", () => {
      const api = setup();

      act(() => api.getState().patchSchema({ id: "Form_X" }));

      expect(api.getState().schema.id).toBe("Form_X");
      expect(api.getState().selectedId).toBeNull();
    });
  });

  describe("form-config drawer", () => {
    it("opens to the requested tab", () => {
      const api = setup();

      act(() => api.getState().setFormConfigTab("dataSources"));

      expect(api.getState().formConfigOpen).toBe(true);
      expect(api.getState().formConfigTab).toBe("dataSources");
    });

    it("toggles open and closed", () => {
      const api = setup();

      act(() => api.getState().setFormConfigOpen(true));
      expect(api.getState().formConfigOpen).toBe(true);

      act(() => api.getState().setFormConfigOpen(false));
      expect(api.getState().formConfigOpen).toBe(false);
    });

    it("ignores open requests outside edit mode", () => {
      const api = setup();
      act(() => api.getState().setViewMode("preview"));

      act(() => api.getState().setFormConfigTab("variables"));

      expect(api.getState().formConfigOpen).toBe(false);
    });
  });
});
