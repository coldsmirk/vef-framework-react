import type { FieldLinkage, FieldLinkageRule, PresentationLayer, TextfieldField } from "../../types";

import { collectRemovalImpact, hasRemovalImpact } from "./removal-impact";

function field(id: string, key: string, linkage?: FieldLinkage): TextfieldField {
  return {
    id: `Field_${id}`,
    type: "textfield",
    key,
    label: `字段${id}`,
    ...linkage !== undefined && { linkage }
  };
}

function showWhen(sourceKey: string): FieldLinkageRule {
  return {
    id: `Rule_show_${sourceKey}`,
    trigger: {
      kind: "condition",
      condition: {
        kind: "group",
        id: `Cond_${sourceKey}`,
        logic: "all",
        children: [
          {
            kind: "leaf",
            id: `Leaf_${sourceKey}`,
            sourceKey,
            operator: "eq",
            value: "1"
          }
        ]
      }
    },
    actions: [{ id: `Action_${sourceKey}`, type: "show" }]
  };
}

function layerOf(children: PresentationLayer["children"]): PresentationLayer {
  return { children };
}

describe("collectRemovalImpact", () => {
  describe("when nothing references the removed field", () => {
    it("reports an empty impact", () => {
      const layer = layerOf([field("a", "a"), field("b", "b")]);

      const impact = collectRemovalImpact(layer, "Field_a");

      expect(hasRemovalImpact(impact)).toBe(false);
      expect(impact.removedRules).toEqual([]);
      expect(impact.unreachable).toEqual([]);
    });
  });

  describe("when surviving rules reference the removed key", () => {
    it("counts the rules each surviving owner loses", () => {
      const layer = layerOf([
        field("a", "a"),
        field("b", "b", { rules: [showWhen("a")] })
      ]);

      const impact = collectRemovalImpact(layer, "Field_a");

      expect(impact.removedRules).toEqual([
        {
          ownerId: "Field_b",
          ownerLabel: "字段b",
          count: 1
        }
      ]);
    });

    it("ignores rules owned by the removed subtree itself", () => {
      const layer = layerOf([
        field("a", "a", { rules: [showWhen("b")] }),
        field("b", "b")
      ]);

      const impact = collectRemovalImpact(layer, "Field_a");

      expect(hasRemovalImpact(impact)).toBe(false);
    });
  });

  describe("when the prune strands a default-hidden field", () => {
    it("reports the field as newly unreachable", () => {
      const layer = layerOf([
        field("a", "a"),
        field("b", "b", { defaults: { hidden: true }, rules: [showWhen("a")] })
      ]);

      const impact = collectRemovalImpact(layer, "Field_a");

      expect(impact.unreachable).toEqual([{ id: "Field_b", label: "字段b" }]);
    });

    it("ignores a show on an edge trigger, matching the validator", () => {
      // `state_action_on_edge_trigger` rejects a state action on an edge
      // trigger, so this rule never reaches the state lane and cannot lift the
      // default. Counting it here left the delete dialog silent about a field
      // that `validateSchema` flags as unreachable one keystroke later.
      const edgeShow: FieldLinkageRule = {
        id: "Rule_edge_show",
        trigger: { kind: "change" },
        actions: [{ id: "Action_edge_show", type: "show" }]
      };
      const layer = layerOf([
        field("a", "a"),
        field("b", "b", { defaults: { hidden: true }, rules: [edgeShow, showWhen("a")] })
      ]);

      const impact = collectRemovalImpact(layer, "Field_a");

      expect(impact.unreachable).toEqual([{ id: "Field_b", label: "字段b" }]);
    });

    it("does not re-report a field that was already unreachable", () => {
      const layer = layerOf([
        field("a", "a"),
        field("b", "b", { defaults: { hidden: true }, rules: [] })
      ]);

      const impact = collectRemovalImpact(layer, "Field_a");

      expect(impact.unreachable).toEqual([]);
    });
  });

  describe("form-level linkage", () => {
    it("counts form rules conditioned on the removed root key", () => {
      const layer = layerOf([field("a", "a"), field("b", "b")]);
      const formLinkage: FieldLinkage = {
        rules: [
          {
            id: "Rule_form",
            trigger: showWhen("a").trigger,
            actions: [
              {
                id: "Action_form",
                type: "alert",
                level: "info",
                message: { kind: "literal", value: "hi" }
              }
            ]
          }
        ]
      };

      const impact = collectRemovalImpact(layer, "Field_a", formLinkage);

      expect(impact.formRulesRemoved).toBe(1);
    });
  });

  describe("unknown node", () => {
    it("reports an empty impact", () => {
      const layer = layerOf([field("a", "a")]);

      expect(hasRemovalImpact(collectRemovalImpact(layer, "Field_missing"))).toBe(false);
    });
  });

  describe("partial impacts on surviving rules and data sources", () => {
    it("reports removed set_fields write items and cleared reference slots separately", () => {
      const layer = layerOf([
        field("empNo", "empNo"),
        field("staffName", "staffName"),
        field("phone", "phone"),
        field("lookup", "lookup", {
          rules: [
            {
              id: "R_lookup",
              trigger: { kind: "commit" },
              actions: [
                {
                  id: "A_api",
                  type: "api_call",
                  request: {
                    resource: "md/staff",
                    action: "lookup",
                    params: { keyword: { kind: "reference", path: "empNo" } }
                  },
                  output: "result"
                },
                {
                  id: "A_fill",
                  type: "set_fields",
                  assignments: [
                    { targetKey: "staffName", value: { kind: "reference", path: "$steps.result.name" } },
                    { targetKey: "phone", value: { kind: "reference", path: "empNo" } }
                  ]
                }
              ]
            }
          ]
        })
      ]);

      // Removing `staffName` removes 1 assignment from the surviving rule (not the whole rule).
      const targetImpact = collectRemovalImpact(layer, "Field_staffName");

      expect(hasRemovalImpact(targetImpact)).toBe(true);
      expect(targetImpact.removedRules).toEqual([]);
      expect(targetImpact.removedAssignments).toEqual([
        {
          ownerId: "Field_lookup",
          ownerLabel: "字段lookup",
          count: 1
        }
      ]);
      expect(targetImpact.clearedReferences).toEqual([]);

      // Removing `empNo` clears 2 references (api_call param + surviving set_fields value).
      const refImpact = collectRemovalImpact(layer, "Field_empNo");

      expect(hasRemovalImpact(refImpact)).toBe(true);
      expect(refImpact.removedRules).toEqual([]);
      expect(refImpact.removedAssignments).toEqual([]);
      expect(refImpact.clearedReferences).toEqual([
        {
          ownerId: "Field_lookup",
          ownerLabel: "字段lookup",
          count: 2
        }
      ]);
    });

    it("reports cleared references on form-level rules and form-global remote data sources", () => {
      const layer = layerOf([field("deptId", "deptId"), field("name", "name")]);
      const formLinkage: FieldLinkage = {
        rules: [
          {
            id: "R_form",
            trigger: { kind: "load" },
            actions: [
              {
                id: "A_set",
                type: "set_fields",
                assignments: [
                  { targetKey: "deptId", value: { kind: "literal", value: "d1" } },
                  { targetKey: "name", value: { kind: "reference", path: "deptId" } }
                ]
              }
            ]
          }
        ]
      };
      const impact = collectRemovalImpact(layer, "Field_deptId", formLinkage, [
        {
          id: "DS_team",
          name: "小组列表",
          kind: "remote",
          request: {
            resource: "org/team",
            action: "find_options",
            params: { deptId: { kind: "reference", path: "deptId" } }
          }
        }
      ]);

      expect(hasRemovalImpact(impact)).toBe(true);
      expect(impact.formRulesRemoved).toBe(0);
      expect(impact.formAssignmentsRemoved).toBe(1);
      expect(impact.formReferencesCleared).toBe(1);
      expect(impact.clearedDataSourceReferences).toEqual([{ id: "DS_team", label: "小组列表" }]);
    });
  });
});
