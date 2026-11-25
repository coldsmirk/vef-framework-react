import type { ReactNode } from "react";

import type {
  Block,
  DateField,
  FieldLinkageRule,
  FormSchema,
  NumberField,
  RadioField,
  SectionNode,
  SelectField,
  SubformNode,
  TabsNode,
  TextareaField,
  TextfieldField,
  UploadField
} from "../types";
import type { FormEditorStoreApi } from "./form-store";

import { act, renderHook } from "@testing-library/react";

import { sectionDefinition } from "../components/containers";
import { textfieldDefinition } from "../components/textfield";
import { isKeyedField } from "../engine/keys";
import { createDefaultRegistry } from "../engine/registry/defaults";
import { createDefaultMobileRegistry } from "../engine/registry/defaults-mobile";
import { validateSchema } from "../engine/schema/validate";
import { findField, findNode, findScope, walkFields } from "../engine/schema/walk";
import { FormEditorStoreProvider, hasDateGranularityLiterals, isSidebarVisible, selectFieldCount, useFormEditorStoreApi } from "./form-store";

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

function mobileKeyOf(schema: FormSchema, fieldId: string): string | undefined {
  const layer = schema.presentations.mobile;
  const field = layer === undefined ? undefined : findNode(layer, fieldId);

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

function tabsSchema(): FormSchema {
  return schemaOf([
    {
      id: "tabs",
      type: "tabs",
      tabs: [
        {
          id: "t1",
          label: "\u{4E00}",
          children: [tf("fa", "amount")]
        },
        {
          id: "t2",
          label: "\u{4E8C}",
          children: []
        }
      ]
    },
    tf("fb", "note", { linkage: { rules: [conditionRule("r1", "amount")] } })
  ]);
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

function dateSchemaWithLiterals(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    linkage: {
      rules: [
        {
          id: "form-r1",
          trigger: { kind: "load" },
          actions: [
            {
              type: "set_fields",
              assignments: [{ targetKey: "period", value: { kind: "literal", value: "2026-04-15" } }]
            }
          ]
        }
      ]
    },
    presentations: {
      pc: {
        children: [
          {
            id: "D1",
            type: "date",
            key: "period",
            label: "期间",
            linkage: {
              rules: [
                {
                  id: "r-own",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "group",
                      logic: "all",
                      children: [
                        {
                          kind: "leaf",
                          sourceKey: "period",
                          operator: "eq",
                          value: "2026-04-15"
                        }
                      ]
                    }
                  },
                  actions: [
                    {
                      type: "assign",
                      value: { kind: "literal", value: "2026-04-01" }
                    }
                  ]
                }
              ]
            }
          },
          tf("T1", "note", {
            linkage: {
              rules: [
                {
                  id: "r-sibling",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "group",
                      logic: "all",
                      children: [
                        {
                          kind: "leaf",
                          sourceKey: "period",
                          operator: "gte",
                          value: "2026-01-01"
                        },
                        {
                          kind: "leaf",
                          sourceKey: "period",
                          operator: "notEmpty"
                        }
                      ]
                    }
                  },
                  actions: [
                    { type: "show" },
                    {
                      type: "set_fields",
                      assignments: [{ targetKey: "period", value: { kind: "literal", value: "2026-05-01" } }]
                    },
                    {
                      type: "set_fields",
                      assignments: [{ targetKey: "period", value: { kind: "expression", source: "'2026-05'" } }]
                    }
                  ]
                }
              ]
            }
          })
        ]
      },
      mobile: {
        children: [
          {
            id: "MD1",
            type: "date",
            key: "period",
            label: "期间",
            linkage: {
              rules: [
                {
                  id: "m-own",
                  trigger: { kind: "load" },
                  actions: [
                    {
                      type: "assign",
                      value: { kind: "literal", value: "2026-04-20" }
                    }
                  ]
                }
              ]
            }
          }
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

  describe("removeTab", () => {
    it("prunes a rule that referenced a key inside the removed tab", () => {
      // Deleting a tab deletes its whole body, so it must run the same
      // reference prune a node removal does. A plain block update left `fb`
      // pointing at a key that no longer existed — and the freed `amount` would
      // later be handed to an unrelated new field, silently rebinding the rule.
      const api = setup();
      act(() => api.getState().setSchema(tabsSchema()));

      act(() => api.getState().removeTab("tabs", "t1"));

      expect(findField(api.getState().schema.presentations.pc, "fb")?.linkage?.rules).toEqual([]);
    });

    it("clears a selection that lived inside the removed tab", () => {
      const api = setup();
      act(() => api.getState().setSchema(tabsSchema()));
      act(() => api.getState().selectNode("fa"));

      act(() => api.getState().removeTab("tabs", "t1"));

      expect(api.getState().selectedId).toBeNull();
    });

    it("refuses to remove the last tab", () => {
      // A tabs container with no tabs is rejected by validation, and the
      // properties panel offers no way back.
      const api = setup();
      act(() => api.getState().setSchema(schemaOf([
        {
          id: "tabs",
          type: "tabs",
          tabs: [
            {
              id: "t1",
              label: "\u{4E00}",
              children: []
            }
          ]
        }
      ])));

      act(() => api.getState().removeTab("tabs", "t1"));

      expect((findNode(api.getState().schema.presentations.pc, "tabs") as TabsNode).tabs).toHaveLength(1);
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
                    type: "set_fields",
                    assignments: [{ targetKey: "amount", value: { kind: "literal", value: 1 } }]
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
                    type: "set_fields",
                    assignments: [{ targetKey: "amount", value: { kind: "literal", value: 1 } }]
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

    it("redoes onto the device the change was made on, not the one on screen", () => {
      // The entry pushed to the other stack carried the LIVE view device rather
      // than its own schema's, so undoing after a device switch and redoing
      // jumped the view to a presentation the change was never made on — an
      // undesigned one renders its seed state, so the redo looked inert.
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      act(() => api.getState().setDevice("mobile"));

      act(() => api.getState().undo());
      expect(api.getState().device).toBe("pc");

      act(() => api.getState().redo());

      expect(api.getState().device).toBe("pc");
      expect(rootKeys(api.getState().schema)).toHaveLength(1);
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
    it("gives each keyless edit its own undo step", () => {
      // The default used to be a node-derived key, so every discrete action on
      // one node folded together: three 新增标签 clicks became one Cmd-Z that
      // removed all three, and a 删除标签 folded with whatever came next.
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
        updater: field => { return { ...field, label: "B" }; }
      }));

      expect(api.getState().past).toHaveLength(pastAfterInsert + 2);
    });

    it("folds consecutive edits to one field into a single undo step", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId as string;
      const pastAfterInsert = api.getState().past.length;

      // Folding is opt-in by naming what is being edited — which is what the
      // properties panel does, one key per entry.
      const label = { coalesceKey: `field:${fieldId}:label` };

      act(() => api.getState().editField({
        fieldId,
        updater: field => { return { ...field, label: "A" }; }
      }, label));
      act(() => api.getState().editField({
        fieldId,
        updater: field => { return { ...field, label: "AB" }; }
      }, label));

      // Two edits under the same key share one history entry.
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
    it("names a field whose imported key is empty", () => {
      // `isKeyedField` is a VALUE guard, so it refused the one field that most
      // needs a key: an imported one whose key is "", which validateSchema
      // flags as `key_required` and no other action can repair.
      const api = setup();
      act(() => api.getState().setSchema(schemaOf([tf("fa", "")])));

      act(() => api.getState().setFieldKey({ fieldId: "fa", key: "amount" }));

      expect((findField(api.getState().schema.presentations.pc, "fa") as TextfieldField).key).toBe("amount");
    });

    it("falls back to the field type when a key-less field gets an all-invalid name", () => {
      const api = setup();
      act(() => api.getState().setSchema(schemaOf([tf("fa", "")])));

      act(() => api.getState().setFieldKey({ fieldId: "fa", key: "!!!" }));

      // Anything non-empty beats leaving the field unusable.
      expect((findField(api.getState().schema.presentations.pc, "fa") as TextfieldField).key).toBe("textfield");
    });

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
                    type: "set_fields",
                    assignments: [{ targetKey: "amount", value: { kind: "literal", value: 1 } }]
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
      expect(api.getState().schema.linkage?.rules?.[0]?.actions[0]).toMatchObject({
        type: "set_fields",
        assignments: [{ targetKey: "total" }]
      });
    });

    it("renames the same field on both devices", () => {
      // The two trees are designed independently but the DATA layer is shared:
      // the projection folds root-scope fields from both into one inventory
      // deduped by key. Letting a rename apply to one device only would project
      // the field twice and hand the backend a phantom.
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

      expect(mobileKeyOf(api.getState().schema, "m1")).toBe("price");
      expect(keyOf(api.getState().schema, "fa")).toBe("price");
      // The PC root-scope key changed, so the form linkage follows it even
      // though the rename started on mobile.
      expect(api.getState().schema.linkage?.rules?.[0]?.trigger).toMatchObject({
        condition: { sourceKey: "price" }
      });
    });

    it("leaves the other device alone when it does not carry the field", () => {
      // A field present on one device only is a legitimate design difference,
      // not a fork of a shared one.
      const api = setup();
      const formLinkage = { rules: [conditionRule("form-r1", "amount")] };
      act(() => api.getState().setSchema({
        id: "Form_1",
        version: 2,
        linkage: formLinkage,
        presentations: {
          pc: { children: [tf("fa", "amount")] },
          mobile: { children: [tf("m1", "note")] }
        }
      }));
      act(() => api.getState().setDevice("mobile"));

      act(() => api.getState().setFieldKey({ fieldId: "m1", key: "remark" }));

      expect(mobileKeyOf(api.getState().schema, "m1")).toBe("remark");
      expect(keyOf(api.getState().schema, "fa")).toBe("amount");
      expect(api.getState().schema.linkage).toBe(formLinkage);
    });

    it("does not rename onto a key the other device binds to a different field", () => {
      // Uniqueness spans both trees: `amount` on pc and `note` on mobile are
      // two fields, and merging them under one key would make the projection
      // emit one entry for two different bindings.
      const api = setup();
      act(() => api.getState().setSchema({
        id: "Form_1",
        version: 2,
        presentations: {
          pc: { children: [tf("fa", "amount")] },
          mobile: { children: [tf("m1", "note")] }
        }
      }));
      act(() => api.getState().setDevice("mobile"));

      act(() => api.getState().setFieldKey({ fieldId: "m1", key: "amount" }));

      expect(mobileKeyOf(api.getState().schema, "m1")).toBe("amount_2");
      expect(keyOf(api.getState().schema, "fa")).toBe("amount");
    });
  });

  describe("setDateGranularity", () => {
    it("switches granularity, syncs the cross-device twin, scrubs incompatible literals, and restores everything in one undo step", () => {
      const api = setup();
      const initial = dateSchemaWithLiterals();
      act(() => api.getState().setSchema(initial));

      act(() => api.getState().setDateGranularity({ fieldId: "D1", granularity: "month" }));

      expect(api.getState().past).toHaveLength(1);

      const { schema } = api.getState();
      const pcDate = findField(schema.presentations.pc, "D1") as DateField;
      const pcNote = findField(schema.presentations.pc, "T1");
      const mobileDate = findField(schema.presentations.mobile ?? { children: [] }, "MD1") as DateField;

      expect(pcDate.granularity).toBe("month");
      expect(mobileDate.granularity).toBe("month");
      expect(pcDate.linkage?.rules?.[0]?.actions[0]).toEqual({
        type: "assign",
        value: { kind: "literal", value: "" }
      });
      expect(pcDate.linkage?.rules?.[0]?.trigger).toMatchObject({
        condition: { children: [{ sourceKey: "period", value: "" }] }
      });
      expect(pcNote?.linkage?.rules?.[0]?.trigger).toMatchObject({
        condition: {
          children: [
            { sourceKey: "period", value: "" },
            { sourceKey: "period", operator: "notEmpty" }
          ]
        }
      });
      expect(pcNote?.linkage?.rules?.[0]?.actions[1]).toEqual({
        type: "set_fields",
        assignments: [{ targetKey: "period", value: { kind: "literal", value: "" } }]
      });
      expect(pcNote?.linkage?.rules?.[0]?.actions[2]).toEqual({
        type: "set_fields",
        assignments: [{ targetKey: "period", value: { kind: "expression", source: "'2026-05'" } }]
      });
      expect(mobileDate.linkage?.rules?.[0]?.actions[0]).toEqual({
        type: "assign",
        value: { kind: "literal", value: "" }
      });
      expect(schema.linkage?.rules?.[0]?.actions[0]).toEqual({
        type: "set_fields",
        assignments: [{ targetKey: "period", value: { kind: "literal", value: "" } }]
      });

      // One undo restores field granularity, twin granularity, both layers'
      // literals, and the root form linkage atomically.
      act(() => api.getState().undo());
      expect(api.getState().schema).toBe(initial);

      act(() => api.getState().redo());
      expect(api.getState().schema).toBe(schema);
    });

    it("syncs the PC twin and root form linkage when invoked from mobile", () => {
      const api = setup();
      act(() => api.getState().setSchema(dateSchemaWithLiterals()));
      act(() => api.getState().setDevice("mobile"));

      act(() => api.getState().setDateGranularity({ fieldId: "MD1", granularity: "quarter" }));

      const { schema } = api.getState();
      const pcDate = findField(schema.presentations.pc, "D1") as DateField;
      const mobileDate = findField(schema.presentations.mobile ?? { children: [] }, "MD1") as DateField;

      expect(mobileDate.granularity).toBe("quarter");
      expect(pcDate.granularity).toBe("quarter");
      expect(schema.linkage?.rules?.[0]?.actions[0]).toEqual({
        type: "set_fields",
        assignments: [{ targetKey: "period", value: { kind: "literal", value: "" } }]
      });
    });

    it("leaves root form linkage and mismatched-type counterparts untouched", () => {
      const api = setup();
      const formLinkage = {
        rules: [
          {
            id: "form-r1",
            trigger: { kind: "load" as const },
            actions: [
              {
                type: "set_fields" as const,
                assignments: [{ targetKey: "period", value: { kind: "literal" as const, value: "2026-04-15" } }]
              }
            ]
          }
        ]
      };
      act(() => api.getState().setSchema({
        id: "Form_1",
        version: 2,
        linkage: formLinkage,
        presentations: {
          pc: { children: [tf("T1", "period")] },
          mobile: {
            children: [
              {
                id: "MD1",
                type: "date",
                key: "period"
              }
            ]
          }
        }
      }));
      act(() => api.getState().setDevice("mobile"));

      act(() => api.getState().setDateGranularity({ fieldId: "MD1", granularity: "year" }));

      const { schema } = api.getState();
      expect((findField(schema.presentations.mobile ?? { children: [] }, "MD1") as DateField).granularity).toBe("year");
      expect(findField(schema.presentations.pc, "T1")?.type).toBe("textfield");
      expect(schema.linkage).toBe(formLinkage);
    });

    it("drops the granularity key when switching back to default day", () => {
      const api = setup();
      act(() => api.getState().setSchema(schemaOf([
        {
          id: "D1",
          type: "date",
          key: "period",
          granularity: "quarter"
        }
      ])));

      act(() => api.getState().setDateGranularity({ fieldId: "D1", granularity: "day" }));

      const updated = findField(api.getState().schema.presentations.pc, "D1") as DateField;
      expect("granularity" in updated).toBe(false);
    });

    it("pushes no history entry when the granularity is unchanged, the id is stale, or the field is not a date", () => {
      const api = setup();
      act(() => api.getState().setSchema(schemaOf([
        {
          id: "D1",
          type: "date",
          key: "period",
          granularity: "month"
        },
        tf("T1", "note")
      ])));
      const before = api.getState();

      act(() => api.getState().setDateGranularity({ fieldId: "D1", granularity: "month" }));
      act(() => api.getState().setDateGranularity({ fieldId: "ghost", granularity: "year" }));
      act(() => api.getState().setDateGranularity({ fieldId: "T1", granularity: "year" }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });

    it("keeps a subform date field isolated from a same-named root field and form linkage", () => {
      const api = setup();
      const formLinkage = {
        rules: [
          {
            id: "form-r1",
            trigger: { kind: "load" as const },
            actions: [
              {
                type: "set_fields" as const,
                assignments: [{ targetKey: "period", value: { kind: "literal" as const, value: "2026-04-15" } }]
              }
            ]
          }
        ]
      };
      const pcRootDate: DateField = {
        id: "D-root",
        type: "date",
        key: "period"
      };
      const pcSubform: SubformNode = {
        id: "sf",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [
          {
            id: "D-sub",
            type: "date",
            key: "period",
            linkage: {
              rules: [
                {
                  id: "r-sub",
                  trigger: { kind: "load" },
                  actions: [
                    {
                      type: "assign",
                      value: { kind: "literal", value: "2026-04-15" }
                    }
                  ]
                }
              ]
            }
          }
        ]
      };
      const mobileSubform: SubformNode = {
        id: "m-sf",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [
          {
            id: "MD-sub",
            type: "date",
            key: "period"
          }
        ]
      };

      act(() => api.getState().setSchema({
        id: "Form_1",
        version: 2,
        linkage: formLinkage,
        presentations: {
          pc: { children: [pcRootDate, pcSubform] },
          mobile: { children: [mobileSubform] }
        }
      }));

      act(() => api.getState().setDateGranularity({ fieldId: "D-sub", granularity: "month" }));

      const { schema } = api.getState();
      const subDate = findField(schema.presentations.pc, "D-sub") as DateField;
      const mobileSubDate = findField(schema.presentations.mobile ?? { children: [] }, "MD-sub") as DateField;
      expect(subDate.granularity).toBe("month");
      expect(mobileSubDate.granularity).toBe("month");
      expect(subDate.linkage?.rules?.[0]?.actions[0]).toEqual({
        type: "assign",
        value: { kind: "literal", value: "" }
      });
      // Root field and form-level linkage are a different scope and keep identity.
      expect(findField(schema.presentations.pc, "D-root")).toBe(pcRootDate);
      expect(schema.linkage).toBe(formLinkage);
    });

    it("detects authored date literals across active layer, twin layer, and PC root linkage", () => {
      const schema = dateSchemaWithLiterals();
      expect(hasDateGranularityLiterals(schema, "pc", "D1")).toBe(true);
      expect(hasDateGranularityLiterals(schema, "mobile", "MD1")).toBe(true);

      const clean = schemaOf([
        {
          id: "D1",
          type: "date",
          key: "period"
        }
      ]);
      expect(hasDateGranularityLiterals(clean, "pc", "D1")).toBe(false);
    });
  });

  describe("saveVariable", () => {
    it("renames the declaration and rewrites references in one undo step", () => {
      const api = setup();
      act(() => api.getState().setSchema(variablesSchema()));

      act(() => api.getState().saveVariable({
        id: "Var_1",
        name: "total",
        type: "number",
        defaultValue: 9
      }));

      expect(api.getState().past).toHaveLength(1);
      expect(api.getState().schema.variables?.map(variable => variable.name)).toEqual(["total", "other"]);
      expect(api.getState().schema.variables?.[0]).toMatchObject({ type: "number", defaultValue: 9 });
      const action = findField(api.getState().schema.presentations.pc, "fa")?.linkage?.rules?.[0]?.actions[0];
      expect(action).toMatchObject({ type: "set_variable", variable: "total" });

      act(() => api.getState().undo());

      expect(api.getState().schema.variables?.[0]?.name).toBe("count");
      const restored = findField(api.getState().schema.presentations.pc, "fa")?.linkage?.rules?.[0]?.actions[0];
      expect(restored).toMatchObject({ variable: "count" });
    });

    it("inserts a new variable after the given one, else at the end", () => {
      const api = setup();
      act(() => api.getState().setSchema(variablesSchema()));

      act(() => api.getState().saveVariable({
        id: "Var_3",
        name: "copy",
        type: "string"
      }, { after: "Var_1" }));
      act(() => api.getState().saveVariable({
        id: "Var_4",
        name: "last",
        type: "string"
      }));

      expect(api.getState().schema.variables?.map(variable => variable.id)).toEqual(["Var_1", "Var_3", "Var_2", "Var_4"]);
    });

    it("no-ops on an invalid identifier or a collision", () => {
      const api = setup();
      act(() => api.getState().setSchema(variablesSchema()));
      const before = api.getState();

      act(() => api.getState().saveVariable({
        id: "Var_1",
        name: "not valid",
        type: "number"
      }));
      act(() => api.getState().saveVariable({
        id: "Var_1",
        name: "other",
        type: "number"
      }));

      expect(api.getState().schema).toBe(before.schema);
      expect(api.getState().past).toBe(before.past);
    });
  });

  describe("saveDataSource", () => {
    it("inserts and replaces sources, each save its own undo step", () => {
      const api = setup();

      act(() => api.getState().saveDataSource({
        id: "ds1",
        name: "一",
        kind: "static",
        options: []
      }));
      act(() => api.getState().saveDataSource({
        id: "ds2",
        name: "二",
        kind: "static",
        options: []
      }));
      act(() => api.getState().saveDataSource({
        id: "ds1",
        name: "一改",
        kind: "static",
        options: []
      }));
      act(() => api.getState().saveDataSource({
        id: "ds3",
        name: "三",
        kind: "static",
        options: []
      }, { after: "ds1" }));

      expect(api.getState().schema.dataSources?.map(source => source.name)).toEqual(["一改", "三", "二"]);
      expect(api.getState().past).toHaveLength(4);

      act(() => api.getState().undo());
      act(() => api.getState().undo());

      expect(api.getState().schema.dataSources?.map(source => source.name)).toEqual(["一", "二"]);
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

      act(() => api.getState().removeVariable("Var_1"));

      // A set_variable to an undeclared name stays semantically valid at
      // runtime, so only the declaration goes; the emptied collection drops
      // its key entirely.
      expect(api.getState().schema.variables).toBeUndefined();
      const action = findField(api.getState().schema.presentations.pc, "fa")?.linkage?.rules?.[0]?.actions[0];
      expect(action).toMatchObject({ type: "set_variable", variable: "count" });
    });

    it("no-ops when no variable has the id", () => {
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
    it("returns to the no-mobile seed state when replaceMobile is undone", () => {
      const api = setup();
      act(() => api.getState().setDevice("mobile"));

      act(() => api.getState().replaceMobile({ children: [] }));
      expect(api.getState().schema.presentations.mobile).toBeDefined();
      expect(api.getState().device).toBe("mobile");

      act(() => api.getState().undo());

      // replaceMobile is an ordinary checkpointed mutation: a single undo removes
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
    it("keeps the required id when a patch carries an explicit undefined", () => {
      const api = setup();
      const { id } = api.getState().schema;

      act(() => api.getState().patchSchema({ id: undefined, variables: [] }));

      expect(api.getState().schema.id).toBe(id);
    });

    it("does not materialize an undesigned presentation through a gap edit", () => {
      // A layout preference must not make a device-design decision: writing the
      // gap onto `currentLayer`'s empty-layer fallback replaced the mobile seed
      // state — and its one-click convert-from-PC entry — with a blank canvas.
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      act(() => api.getState().setDevice("mobile"));

      act(() => api.getState().patchSchema({ gap: "large" }));

      expect(api.getState().schema.presentations.mobile).toBeUndefined();
    });

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
      act(() => api.getState().replaceMobile({ children: [] }));

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

  describe("requestDataEdit", () => {
    it("switches to the data tab and makes each request distinct until it is consumed", () => {
      const api = setup();

      act(() => api.getState().requestDataEdit({ kind: "dataSource", id: "ds1" }));
      const first = api.getState().pendingDataEdit;

      expect(api.getState().sidebarTab).toBe("data");
      expect(first).toEqual({ kind: "dataSource", id: "ds1" });

      act(() => api.getState().requestDataEdit({ kind: "dataSource", id: "ds1" }));

      expect(api.getState().pendingDataEdit).not.toBe(first);

      act(() => api.getState().clearPendingDataEdit());

      expect(api.getState().pendingDataEdit).toBeNull();
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

      expect(isSidebarVisible(api.getState())).toBe(false);
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

    it("closes the narrow right overlay when leaving edit mode while keeping tabs", () => {
      const api = setup();
      act(() => {
        api.getState().setSidebarTab("data");
        api.getState().setPropertiesTab("form");
      });
      expect(api.getState().propertiesDrawerOpen).toBe(true);

      act(() => api.getState().setViewMode("preview"));

      expect(api.getState().propertiesDrawerOpen).toBe(false);
      expect(api.getState().sidebarTab).toBe("data");
    });
  });

  describe("control selection", () => {
    it("activates control tab on select and reverts to form on selectNode(null)", () => {
      const api = setup();
      expect(api.getState().propertiesTab).toBe("form");

      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      expect(api.getState().selectedId).not.toBeNull();
      expect(api.getState().propertiesTab).toBe("control");
      expect(api.getState().propertiesDrawerOpen).toBe(true);

      act(() => api.getState().selectNode(null));

      expect(api.getState().selectedId).toBeNull();
      expect(api.getState().propertiesTab).toBe("form");
      expect(api.getState().propertiesDrawerOpen).toBe(false);
    });

    it("allows manual switch to form while selected and returns to control on reselect", () => {
      const api = setup();
      act(() => api.getState().insertField({ definition: textfieldDefinition }));
      const fieldId = api.getState().selectedId!;

      act(() => api.getState().setPropertiesTab("form"));

      expect(api.getState().selectedId).toBe(fieldId);
      expect(api.getState().propertiesTab).toBe("form");

      act(() => api.getState().selectNode(fieldId));

      expect(api.getState().propertiesTab).toBe("control");
    });

    it("leaves the selection untouched when a form-level patch is applied", () => {
      const api = setup();

      act(() => api.getState().patchSchema({ id: "Form_X" }));

      expect(api.getState().schema.id).toBe("Form_X");
      expect(api.getState().selectedId).toBeNull();
    });
  });

  describe("side panel tabs", () => {
    it("switches the left sidebar tab", () => {
      const api = setup();
      expect(api.getState().sidebarTab).toBe("palette");

      act(() => api.getState().setSidebarTab("data"));
      expect(api.getState().sidebarTab).toBe("data");

      act(() => api.getState().setSidebarTab("outline"));
      expect(api.getState().sidebarTab).toBe("outline");
    });

    it("refuses switching the right panel to control when nothing is selected", () => {
      const api = setup();

      act(() => api.getState().setPropertiesTab("control"));

      expect(api.getState().propertiesTab).toBe("form");
      expect(api.getState().propertiesDrawerOpen).toBe(false);
    });

    it("opens and closes the narrow right overlay", () => {
      const api = setup();

      act(() => api.getState().setPropertiesTab("form"));
      expect(api.getState().propertiesDrawerOpen).toBe(true);

      act(() => api.getState().setPropertiesDrawerOpen(false));
      expect(api.getState().propertiesDrawerOpen).toBe(false);
    });

    it("ignores panel tab switches outside edit mode", () => {
      const api = setup();
      act(() => api.getState().setViewMode("preview"));

      act(() => {
        api.getState().setSidebarTab("data");
        api.getState().setPropertiesTab("form");
      });

      expect(api.getState().sidebarTab).toBe("palette");
      expect(api.getState().propertiesDrawerOpen).toBe(false);
    });
  });

  describe("cross-device twin contract sync", () => {
    it("syncs selection dataSource, validation, columnType, precision, and upload maxCount to the twin in one undo step", () => {
      const api = setup();
      const initial: FormSchema = {
        id: "Form_1",
        version: 2,
        presentations: {
          pc: {
            children: [
              {
                id: "P-Sel",
                type: "select",
                key: "grade",
                label: "PC 等级",
                dataSource: { kind: "static", options: [{ label: "甲", value: "a" }] }
              },
              {
                id: "P-Num",
                type: "number",
                key: "amount",
                label: "金额"
              },
              {
                id: "P-Up",
                type: "upload",
                key: "files",
                label: "附件",
                maxCount: 1
              },
              {
                id: "P-Code",
                type: "code-editor",
                key: "script",
                label: "脚本"
              }
            ]
          },
          mobile: {
            children: [
              {
                id: "M-Sel",
                type: "radio",
                key: "grade",
                label: "移动端等级",
                direction: "horizontal",
                dataSource: { kind: "static", options: [{ label: "甲", value: "a" }] }
              },
              {
                id: "M-Num",
                type: "number",
                key: "amount",
                label: "手机金额",
                prefix: "¥"
              },
              {
                id: "M-Up",
                type: "upload",
                key: "files",
                label: "手机附件",
                maxCount: 1,
                dragger: true
              },
              {
                id: "M-Code",
                type: "textarea",
                key: "script",
                label: "手机脚本"
              }
            ]
          }
        }
      };

      act(() => api.getState().setSchema(initial));

      // Edit select options + required + columnType on PC -> syncs to mobile radio twin.
      const nextOptions = {
        kind: "static" as const,
        options: [
          { label: "甲等", value: "a" },
          { label: "乙等", value: "b" }
        ]
      };

      act(() => api.getState().editField({
        fieldId: "P-Sel",
        updater: field => {
          return {
            ...field,
            dataSource: nextOptions,
            columnType: "string",
            validate: { required: true }
          };
        }
      }));

      expect(api.getState().past).toHaveLength(1);
      const mobileRadio = findField(api.getState().schema.presentations.mobile!, "M-Sel") as RadioField;
      expect(mobileRadio.label).toBe("移动端等级");
      expect(mobileRadio.direction).toBe("horizontal");
      expect(mobileRadio.dataSource).toEqual(nextOptions);
      expect(mobileRadio.columnType).toBe("string");
      expect(mobileRadio.validate).toEqual({ required: true });

      // Single undo restores both devices atomically.
      act(() => api.getState().undo());
      expect(api.getState().schema).toBe(initial);

      // Edit number precision + validate.min on mobile -> syncs back to PC twin.
      act(() => api.getState().setDevice("mobile"));
      act(() => api.getState().editField({
        fieldId: "M-Num",
        updater: field => {
          return {
            ...field,
            precision: 2,
            validate: { min: 0, max: 999 }
          };
        }
      }));

      const pcNum = findField(api.getState().schema.presentations.pc, "P-Num") as NumberField;
      expect(pcNum.label).toBe("金额");
      expect(pcNum.precision).toBe(2);
      expect(pcNum.validate).toEqual({ min: 0, max: 999 });

      // Edit upload maxCount and code-editor validate on PC -> syncs to mobile upload / textarea twins.
      act(() => api.getState().setDevice("pc"));
      act(() => api.getState().editField({
        fieldId: "P-Up",
        updater: field => {
          return { ...field, maxCount: 3 };
        }
      }));
      act(() => api.getState().editField({
        fieldId: "P-Code",
        updater: field => {
          return { ...field, validate: { required: true, maxLength: 500 } };
        }
      }));

      const mobileUpload = findField(api.getState().schema.presentations.mobile!, "M-Up") as UploadField;
      const mobileTextarea = findField(api.getState().schema.presentations.mobile!, "M-Code") as TextareaField;
      expect(mobileUpload.maxCount).toBe(3);
      expect(mobileUpload.dragger).toBe(true);
      expect(mobileTextarea.validate).toEqual({ required: true, maxLength: 500 });
    });

    it("syncs subform row contract changes and nested column edits while keeping display properties independent", () => {
      const api = setup();
      const initial: FormSchema = {
        id: "Form_1",
        version: 2,
        presentations: {
          pc: {
            children: [
              {
                id: "P-Sub",
                type: "subform",
                variant: "table",
                key: "checks",
                label: "PC 自查表",
                rows: {
                  mode: "fixed",
                  itemKey: "item",
                  headerLabel: "PC 检查项",
                  headerWidth: 240,
                  required: true,
                  source: { kind: "static", options: [{ label: "项1", value: "1" }] }
                },
                template: [
                  {
                    id: "P-Col",
                    type: "select",
                    key: "result",
                    label: "PC 结果",
                    dataSource: { kind: "static", options: [{ label: "合格", value: "ok" }] }
                  }
                ]
              }
            ]
          },
          mobile: {
            children: [
              {
                id: "M-Sub",
                type: "subform",
                variant: "stack",
                key: "checks",
                label: "移动端自查",
                rows: {
                  mode: "fixed",
                  itemKey: "item",
                  headerLabel: "移动端检查项",
                  headerWidth: 150,
                  required: true,
                  source: { kind: "static", options: [{ label: "项1", value: "1" }] }
                },
                template: [
                  {
                    id: "M-Col",
                    type: "select",
                    key: "result",
                    label: "手机结果",
                    dataSource: { kind: "static", options: [{ label: "合格", value: "ok" }] }
                  }
                ]
              }
            ]
          }
        }
      };

      act(() => api.getState().setSchema(initial));

      // Presentation-only edits on PC subform must leave mobile layer reference untouched.
      const mobileBeforeDisplayEdit = api.getState().schema.presentations.mobile;
      act(() => api.getState().updateBlock({
        nodeId: "P-Sub",
        updater: node => node.type === "subform" && node.rows?.mode === "fixed"
          ? {
              ...node,
              label: "PC 新标题",
              rows: {
                ...node.rows,
                headerLabel: "PC 新行头",
                headerWidth: 300
              }
            }
          : node
      }));
      expect(api.getState().schema.presentations.mobile).toBe(mobileBeforeDisplayEdit);

      // Editing fixed-row source + itemKey + required syncs to mobile twin while preserving mobile's headerLabel/headerWidth.
      const updatedSource = {
        kind: "static" as const,
        options: [
          { label: "项1", value: "1" },
          { label: "项2", value: "2" }
        ]
      };
      const pastBeforeContractEdit = api.getState().past.length;
      act(() => api.getState().updateBlock({
        nodeId: "P-Sub",
        updater: node => node.type === "subform" && node.rows?.mode === "fixed"
          ? {
              ...node,
              rows: {
                ...node.rows,
                itemKey: "clause",
                required: false,
                source: updatedSource
              }
            }
          : node
      }));

      expect(api.getState().past).toHaveLength(pastBeforeContractEdit + 1);
      const mobileSub = findNode(api.getState().schema.presentations.mobile!, "M-Sub") as SubformNode;
      expect(mobileSub.label).toBe("移动端自查");
      expect(mobileSub.variant).toBe("stack");
      expect(mobileSub.rows).toEqual({
        mode: "fixed",
        itemKey: "clause",
        headerLabel: "移动端检查项",
        headerWidth: 150,
        required: false,
        source: updatedSource
      });

      // Editing a column inside the subform syncs only the same-scope twin column on mobile.
      const nextColSource = { kind: "codeSet" as const, codeSet: "check.result" };
      act(() => api.getState().editField({
        fieldId: "P-Col",
        updater: field => {
          return {
            ...field,
            dataSource: nextColSource,
            validate: { required: true }
          };
        }
      }));

      const mobileCol = findField(api.getState().schema.presentations.mobile!, "M-Col") as SelectField;
      expect(mobileCol.label).toBe("手机结果");
      expect(mobileCol.dataSource).toEqual(nextColSource);
      expect(mobileCol.validate).toEqual({ required: true });

      // Undo reverts the column edit on both devices in one step.
      act(() => api.getState().undo());
      const revertedMobileCol = findField(api.getState().schema.presentations.mobile!, "M-Col") as SelectField;
      expect(revertedMobileCol.dataSource).toEqual({ kind: "static", options: [{ label: "合格", value: "ok" }] });
      expect(revertedMobileCol.validate).toBeUndefined();
    });

    it("leaves the other device untouched for presentation-only leaf edits and device-only fields", () => {
      const api = setup();
      const initial: FormSchema = {
        id: "Form_1",
        version: 2,
        presentations: {
          pc: {
            children: [
              tf("P1", "shared", { label: "PC 共享" }),
              tf("P2", "pcOnly", { label: "仅 PC" })
            ]
          },
          mobile: {
            children: [tf("M1", "shared", { label: "手机共享" })]
          }
        }
      };

      act(() => api.getState().setSchema(initial));
      const mobileLayer = api.getState().schema.presentations.mobile;

      act(() => api.getState().editField({
        fieldId: "P1",
        updater: field => {
          return {
            ...field,
            label: "新标签",
            placeholder: "新占位符"
          };
        }
      }));
      act(() => api.getState().editField({
        fieldId: "P2",
        updater: field => {
          return { ...field, validate: { required: true } };
        }
      }));

      expect(api.getState().schema.presentations.mobile).toBe(mobileLayer);
    });
  });
});
