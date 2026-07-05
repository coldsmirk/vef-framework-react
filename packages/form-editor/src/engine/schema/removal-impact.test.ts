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
});
