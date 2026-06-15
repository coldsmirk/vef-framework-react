import type {
  Block,
  ButtonField,
  FieldLinkage,
  FieldLinkageRule,
  LinkageConditionLeaf,
  LinkageOperator,
  RuntimeSchema,
  TextfieldField
} from "../../types";
import type { ValidationIssue } from "./index";

import {
  collectConditionEffectRules,
  defaultEvaluateAssignExpression,
  defaultEvaluateExpression,
  deriveDefaultValues,
  deriveExpressionVariables,
  evaluateConditionEffectTruths,
  evaluateLinkage,
  evaluateRuntimeStates,
  getFieldEventTriggerKinds,
  getLinkageSourceKeys,
  getTriggerEffectActions,
  isEmptyRuntimeValue,
  resolveLinkageEvaluators,
  validateLinkageSchema
} from "./index";
import { matchLeaf } from "./operators";

function makeField(key: string, overrides: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id: `Field_${key}`,
    type: "textfield",
    key,
    label: key,
    ...overrides
  };
}

function makeSchema(fields: Block[]): RuntimeSchema {
  return {
    id: "Form_1",
    children: fields
  };
}

/**
 * A leaf condition on `sourceKey "v"` for direct `matchLeaf` exercises.
 */
function leafOf(operator: LinkageOperator, value?: unknown): LinkageConditionLeaf {
  return {
    kind: "leaf",
    sourceKey: "v",
    operator,
    value
  };
}

function codesOf(issues: ValidationIssue[]): string[] {
  return issues.map(issue => issue.code);
}

/**
 * A condition trigger comparing `sourceKey` eq "1".
 */
function leafTrigger(sourceKey: string): FieldLinkageRule["trigger"] {
  return {
    kind: "condition",
    condition: {
      kind: "leaf",
      sourceKey,
      operator: "eq",
      value: "1"
    }
  };
}

/**
 * A field whose single condition rule sources `sourceKey` and runs `actions`.
 */
function fieldWithRule(key: string, sourceKey: string, actions: FieldLinkageRule["actions"]): TextfieldField {
  return makeField(key, {
    linkage: {
      rules: [
        {
          id: `Rule_${key}`,
          trigger: leafTrigger(sourceKey),
          actions
        }
      ]
    }
  });
}

/**
 * A `set_field` effect that re-fires on every tracked source change — the
 * variant that registers cycle edges.
 */
function setFieldAlways(targetKey: string): FieldLinkageRule["actions"][number] {
  return {
    type: "set_field",
    targetKey,
    retrigger: "always",
    value: { kind: "literal", value: 1 }
  };
}

/**
 * A root field, a hide-when-status-off field, and a subform whose template
 * field carries its own linkage — the `evaluateRuntimeStates` scoping fixture.
 */
function statesSchema(): RuntimeSchema {
  return makeSchema([
    makeField("status"),
    makeField("target", {
      linkage: {
        rules: [
          {
            id: "Rule_1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "status",
                operator: "eq",
                value: "off"
              }
            },
            actions: [{ type: "hide" }]
          }
        ]
      }
    }),
    {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      template: [
        makeField("note", {
          id: "Field_row_note",
          linkage: { defaults: { hidden: true } }
        })
      ]
    }
  ]);
}

describe("linkage engine", () => {
  describe("state lane — leaf conditions", () => {
    it("applies show action when a leaf eq condition matches", () => {
      const field = makeField("target", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "enterprise"
                }
              },
              actions: [{ type: "show" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { type: "enterprise" }).hidden).toBe(false);
      expect(evaluateLinkage(field, { type: "personal" }).hidden).toBe(true);
    });

    it("respects rule order — later matching rule overwrites earlier", () => {
      const field = makeField("target", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "enterprise"
                }
              },
              actions: [{ type: "show" }]
            },
            {
              id: "Rule_2",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "contains",
                  value: "blocked"
                }
              },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { type: "enterprise-blocked" }).hidden).toBe(true);
    });

    it("applies every state action in a multi-action rule in order", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "vip"
                }
              },
              actions: [
                { type: "require" },
                { type: "assign", value: { kind: "literal", value: "gold" } }
              ]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { type: "vip" })).toMatchObject({
        required: true,
        assigned: true,
        assignedValue: "gold"
      });
    });

    it("supports dynamic required and literal assignment", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "notEmpty"
                }
              },
              actions: [{ type: "require" }]
            },
            {
              id: "Rule_2",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "enterprise"
                }
              },
              actions: [{ type: "assign", value: { kind: "literal", value: "approved" } }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { type: "personal" }).required).toBe(true);
      expect(evaluateLinkage(field, { type: "enterprise" })).toMatchObject({
        assigned: true,
        assignedValue: "approved",
        required: true
      });
    });

    it("treats an empty source as non-matching for ordered operators", () => {
      const field = makeField("target", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "amount",
                  operator: "gte",
                  value: 0
                }
              },
              actions: [{ type: "show" }]
            }
          ]
        }
      });

      // An unset / empty field must not coerce to 0 and satisfy `gte 0`.
      expect(evaluateLinkage(field, {}).hidden).toBe(true);
      expect(evaluateLinkage(field, { amount: "" }).hidden).toBe(true);
      expect(evaluateLinkage(field, { amount: 5 }).hidden).toBe(false);
    });

    it("treats an empty expected value as non-matching for contains", () => {
      const field = makeField("target", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "name",
                  operator: "contains"
                }
              },
              actions: [{ type: "show" }]
            }
          ]
        }
      });

      // A contains-leaf with no configured value must not match every string.
      expect(evaluateLinkage(field, { name: "anything" }).hidden).toBe(true);
    });
  });

  describe("state lane — effect actions are skipped", () => {
    it("folds the state action but never the effect action in a mixed rule", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "type",
                  operator: "eq",
                  value: "vip"
                }
              },
              actions: [
                { type: "hide" },
                { type: "alert", message: { kind: "literal", value: "hi" } }
              ]
            }
          ]
        }
      });

      // hide is folded; the alert effect must not corrupt state or throw.
      expect(evaluateLinkage(field, { type: "vip" })).toMatchObject({
        hidden: true,
        assigned: false
      });
    });

    it("leaves state at its defaults for an effect-only condition rule", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "amount",
                  operator: "gt",
                  value: 100
                }
              },
              actions: [
                {
                  type: "set_field",
                  targetKey: "other",
                  value: { kind: "literal", value: 1 }
                }
              ]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { amount: 200 })).toMatchObject({
        hidden: false,
        disabled: false,
        required: false,
        assigned: false
      });
    });

    it("never derives state from an edge-triggered rule", () => {
      const field = makeField("target", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "Rule_1",
              trigger: { kind: "change" },
              actions: [{ type: "alert", message: { kind: "literal", value: "changed" } }]
            }
          ]
        }
      });

      // The change-triggered rule is ignored by the state lane; defaults stand.
      expect(evaluateLinkage(field, { target: "x" }).hidden).toBe(true);
    });
  });

  describe("state lane — group conditions", () => {
    it("requires all children to match under all-logic", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "group",
                  logic: "all",
                  children: [
                    {
                      kind: "leaf",
                      sourceKey: "type",
                      operator: "eq",
                      value: "vip"
                    },
                    {
                      kind: "leaf",
                      sourceKey: "amount",
                      operator: "gt",
                      value: 100
                    }
                  ]
                }
              },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { type: "vip", amount: 200 }).hidden).toBe(true);
      expect(evaluateLinkage(field, { type: "vip", amount: 50 }).hidden).toBe(false);
      expect(evaluateLinkage(field, { type: "regular", amount: 200 }).hidden).toBe(false);
    });

    it("any-logic matches when at least one child matches", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "group",
                  logic: "any",
                  children: [
                    {
                      kind: "leaf",
                      sourceKey: "a",
                      operator: "eq",
                      value: "x"
                    },
                    {
                      kind: "leaf",
                      sourceKey: "b",
                      operator: "eq",
                      value: "y"
                    }
                  ]
                }
              },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { a: "x", b: "z" }).hidden).toBe(true);
      expect(evaluateLinkage(field, { a: "z", b: "y" }).hidden).toBe(true);
      expect(evaluateLinkage(field, { a: "z", b: "z" }).hidden).toBe(false);
    });

    it("supports nested groups combining all and any", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "group",
                  logic: "all",
                  children: [
                    {
                      kind: "leaf",
                      sourceKey: "a",
                      operator: "eq",
                      value: "x"
                    },
                    {
                      kind: "group",
                      logic: "any",
                      children: [
                        {
                          kind: "leaf",
                          sourceKey: "b",
                          operator: "eq",
                          value: "y"
                        },
                        {
                          kind: "leaf",
                          sourceKey: "c",
                          operator: "eq",
                          value: "z"
                        }
                      ]
                    }
                  ]
                }
              },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, {
        a: "x",
        b: "y",
        c: "?"
      }).hidden).toBe(true);
      expect(evaluateLinkage(field, {
        a: "x",
        b: "?",
        c: "z"
      }).hidden).toBe(true);
      expect(evaluateLinkage(field, {
        a: "x",
        b: "?",
        c: "?"
      }).hidden).toBe(false);
      expect(evaluateLinkage(field, {
        a: "?",
        b: "y",
        c: "z"
      }).hidden).toBe(false);
    });
  });

  describe("state lane — expression conditions", () => {
    it("invokes the default new Function evaluator and returns a boolean", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "expression",
                  source: "field.type === \"enterprise\" && field.amount > 10"
                }
              },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { type: "enterprise", amount: 20 }).hidden).toBe(true);
      expect(evaluateLinkage(field, { type: "enterprise", amount: 5 }).hidden).toBe(false);
    });

    it("returns false rather than throw on a broken expression", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: { kind: "condition", condition: { kind: "expression", source: "this is not js" } },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, {}).hidden).toBe(false);
    });

    it("honors a host-supplied expression evaluator override", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: { kind: "condition", condition: { kind: "expression", source: "ignored" } },
              actions: [{ type: "show" }]
            }
          ]
        }
      });

      const evaluators = {
        evaluateExpression: vi.fn().mockReturnValue(true)
      };

      const state = evaluateLinkage(field, { foo: 1 }, { evaluators });
      expect(state.hidden).toBe(false);
      // The evaluator now also receives the (here absent) expression context.
      expect(evaluators.evaluateExpression).toHaveBeenCalledWith("ignored", { foo: 1 }, undefined);
    });
  });

  describe("expression scope", () => {
    it("exposes $vars and $form to an expression condition", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: { kind: "condition", condition: { kind: "expression", source: "$vars.flag === true && $form.amount > 5" } },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { amount: 10 }, { expressionContext: { variables: { flag: true } } }).hidden).toBe(true);
      expect(evaluateLinkage(field, { amount: 10 }, { expressionContext: { variables: { flag: false } } }).hidden).toBe(false);
      expect(evaluateLinkage(field, { amount: 3 }, { expressionContext: { variables: { flag: true } } }).hidden).toBe(false);
    });

    it("keeps the legacy `field` alias working alongside $form", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: { kind: "condition", condition: { kind: "expression", source: "field.amount === $form.amount" } },
              actions: [{ type: "hide" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { amount: 1 }).hidden).toBe(true);
    });

    it("resolves $vars in an assign expression", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "R1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "base",
                  operator: "notEmpty"
                }
              },
              actions: [{ type: "assign", value: { kind: "expression", source: "$form.base + $vars.tax" } }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { base: 100 }, { expressionContext: { variables: { tax: 8 } } }).assignedValue).toBe(108);
    });

    it("derives $vars from schema variable defaults", () => {
      const schema = makeSchema([makeField("a")]);
      schema.variables = [
        {
          id: "v1",
          name: "threshold",
          type: "number",
          defaultValue: 5
        },
        {
          id: "v2",
          name: "blank",
          type: "string"
        }
      ];

      expect(deriveExpressionVariables(schema)).toEqual({ threshold: 5, blank: undefined });
    });
  });

  describe("state lane — script actions", () => {
    it("applies the returned state patch from a script body", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "trigger",
                  operator: "notEmpty"
                }
              },
              actions: [
                {
                  type: "script",
                  source: "return { hidden: field.trigger === \"off\", value: field.trigger + \"!\" };"
                }
              ]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { trigger: "on" })).toMatchObject({
        hidden: false,
        assigned: true,
        assignedValue: "on!"
      });

      expect(evaluateLinkage(field, { trigger: "off" })).toMatchObject({
        hidden: true,
        assigned: true,
        assignedValue: "off!"
      });
    });

    it("treats a void return as no-op", () => {
      const field = makeField("target", {
        linkage: {
          defaults: { hidden: true },
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "trigger",
                  operator: "notEmpty"
                }
              },
              actions: [{ type: "script", source: "/* nothing */" }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { trigger: "any" }).hidden).toBe(true);
    });
  });

  describe("state lane — assign expressions", () => {
    it("evaluates the expression source to compute the assigned value", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "base",
                  operator: "notEmpty"
                }
              },
              actions: [{ type: "assign", value: { kind: "expression", source: "field.base + field.tax" } }]
            }
          ]
        }
      });

      expect(evaluateLinkage(field, { base: 100, tax: 13 }).assignedValue).toBe(113);
    });
  });

  describe("default evaluator compile caching", () => {
    it("returns false on every evaluation of an uncompilable expression", () => {
      // The first call compiles (and fails); the failure is cached as an inert
      // function so the second call must not re-throw or change behavior.
      expect(defaultEvaluateExpression("this is ( not js", { a: 1 })).toBe(false);
      expect(defaultEvaluateExpression("this is ( not js", { a: 2 })).toBe(false);
    });

    it("returns undefined on every evaluation of an uncompilable assign expression", () => {
      expect(defaultEvaluateAssignExpression("also ( broken", {})).toBeUndefined();
      expect(defaultEvaluateAssignExpression("also ( broken", {})).toBeUndefined();
    });
  });

  describe("matchLeaf operator edge cases", () => {
    it("treats an empty expected value as non-matching for every ordered operator", () => {
      // An unfilled condition (`gt` with value "") must not behave as `gt 0`.
      for (const operator of ["gt", "gte", "lt", "lte"] as const) {
        expect(matchLeaf(leafOf(operator, ""), { v: 10 })).toBe(false);
        expect(matchLeaf(leafOf(operator), { v: 10 })).toBe(false);
      }
    });

    it("compares numeric strings numerically for ordered operators", () => {
      expect(matchLeaf(leafOf("gt", 5), { v: "10" })).toBe(true);
      // Lexicographic comparison would say "10" < "9"; numeric must win.
      expect(matchLeaf(leafOf("gt", "9"), { v: "10" })).toBe(true);
    });

    it("matches cross-type equality through string coercion", () => {
      expect(matchLeaf(leafOf("eq", 5), { v: "5" })).toBe(true);
      expect(matchLeaf(leafOf("eq", "5"), { v: 5 })).toBe(true);
    });

    it("treats NaN as equal to itself (Object.is semantics)", () => {
      expect(matchLeaf(leafOf("eq", Number.NaN), { v: Number.NaN })).toBe(true);
    });

    it("returns true for ne when exactly one operand is nullish", () => {
      expect(matchLeaf(leafOf("ne", "x"), {})).toBe(true);
      expect(matchLeaf(leafOf("ne", null), { v: "x" })).toBe(true);
    });

    it("never matches eq on an array or object source", () => {
      // There is no single-value identity for arrays / objects; `contains` is
      // the array operator.
      expect(matchLeaf(leafOf("eq", [1]), { v: [1] })).toBe(false);
      expect(matchLeaf(leafOf("eq", "x"), { v: { x: 1 } })).toBe(false);
    });

    it("returns false for contains on a null source", () => {
      expect(matchLeaf(leafOf("contains", "x"), { v: null })).toBe(false);
    });

    it("returns false for contains on a numeric source", () => {
      expect(matchLeaf(leafOf("contains", 2), { v: 123 })).toBe(false);
    });

    it("matches contains on an array source with loose equality", () => {
      expect(matchLeaf(leafOf("contains", 5), { v: ["5"] })).toBe(true);
    });

    it("treats a plain object as non-empty for empty and notEmpty", () => {
      expect(matchLeaf(leafOf("empty"), { v: {} })).toBe(false);
      expect(matchLeaf(leafOf("notEmpty"), { v: {} })).toBe(true);
    });
  });

  describe("effect lane — pure helpers", () => {
    const evaluators = resolveLinkageEvaluators();

    it("collects only condition-triggered rules carrying effect actions", () => {
      const schema = makeSchema([
        makeField("a", {
          linkage: {
            rules: [
              {
                id: "Rule_state",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "b",
                    operator: "eq",
                    value: "1"
                  }
                },
                actions: [{ type: "hide" }]
              },
              {
                id: "Rule_effect",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "b",
                    operator: "eq",
                    value: "2"
                  }
                },
                actions: [
                  { type: "hide" },
                  { type: "alert", message: { kind: "literal", value: "hey" } }
                ]
              },
              {
                id: "Rule_change",
                trigger: { kind: "change" },
                actions: [{ type: "alert", message: { kind: "literal", value: "changed" } }]
              }
            ]
          }
        })
      ]);

      const collected = collectConditionEffectRules(schema);

      // Only Rule_effect: state-only and edge-triggered rules are excluded; the
      // collected entry carries the effect actions, the condition's source keys,
      // and an empty alwaysActions (no effect opted into "always" retrigger).
      expect(collected).toEqual([
        {
          ruleId: "Rule_effect",
          condition: {
            kind: "leaf",
            sourceKey: "b",
            operator: "eq",
            value: "2"
          },
          sourceKeys: ["b"],
          actions: [{ type: "alert", message: { kind: "literal", value: "hey" } }],
          alwaysActions: []
        }
      ]);
    });

    it("collects an 'always' effect into alwaysActions with the group's source keys", () => {
      const alert = {
        type: "alert",
        retrigger: "always",
        message: { kind: "literal", value: "hey" }
      } as const;
      const rules = collectConditionEffectRules(makeSchema([
        makeField("a", {
          linkage: {
            rules: [
              {
                id: "Rule_always",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "group",
                    logic: "all",
                    children: [
                      {
                        kind: "leaf",
                        sourceKey: "b",
                        operator: "gt",
                        value: 1
                      },
                      {
                        kind: "leaf",
                        sourceKey: "c",
                        operator: "lt",
                        value: 9
                      }
                    ]
                  }
                },
                actions: [alert]
              }
            ]
          }
        })
      ]));

      expect(rules[0]?.sourceKeys).toEqual(["b", "c"]);
      expect(rules[0]?.alwaysActions).toEqual([alert]);
    });

    it("collects a form-scope expression rule with the empty sourceKeys contract", () => {
      // Form-scope condition rules join the root scope's inventory ahead of
      // field rules; an expression condition is opaque, so it advertises no
      // source keys and the runtime re-evaluates it on any value change.
      const schema = makeSchema([makeField("x")]);
      schema.linkage = {
        rules: [
          {
            id: "Rule_form",
            trigger: { kind: "condition", condition: { kind: "expression", source: "$form.x > 1" } },
            actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
          }
        ]
      };

      const collected = collectConditionEffectRules(schema);

      expect(collected).toHaveLength(1);
      expect(collected[0]).toMatchObject({
        ruleId: "Rule_form",
        sourceKeys: [],
        actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
      });
    });

    it("evaluates condition-effect truths positionally", () => {
      const rules = collectConditionEffectRules(makeSchema([
        makeField("a", {
          linkage: {
            rules: [
              {
                id: "R",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "b",
                    operator: "gt",
                    value: 10
                  }
                },
                actions: [{ type: "submit" }]
              }
            ]
          }
        })
      ]));

      expect(evaluateConditionEffectTruths(rules, { b: 20 }, evaluators)).toEqual([true]);
      expect(evaluateConditionEffectTruths(rules, { b: 5 }, evaluators)).toEqual([false]);
    });

    it("flattens a field's effect actions for a given event kind", () => {
      const rules: FieldLinkageRule[] = [
        {
          id: "R1",
          trigger: { kind: "change" },
          actions: [
            {
              type: "set_field",
              targetKey: "x",
              value: { kind: "literal", value: 1 }
            },
            { type: "submit" }
          ]
        },
        {
          id: "R2",
          trigger: { kind: "blur" },
          actions: [{ type: "reset" }]
        }
      ];

      expect(getTriggerEffectActions(rules, "change")).toEqual([
        {
          type: "set_field",
          targetKey: "x",
          value: { kind: "literal", value: 1 }
        },
        { type: "submit" }
      ]);
      expect(getTriggerEffectActions(rules, "blur")).toEqual([{ type: "reset" }]);
      expect(getTriggerEffectActions(rules, "focus")).toEqual([]);
    });

    it("reports the field-event kinds a field listens for", () => {
      const rules: FieldLinkageRule[] = [
        {
          id: "R1",
          trigger: { kind: "change" },
          actions: [{ type: "submit" }]
        },
        {
          id: "R2",
          trigger: { kind: "click" },
          actions: [{ type: "reset" }]
        },
        {
          id: "R3",
          trigger: {
            kind: "condition",
            condition: {
              kind: "leaf",
              sourceKey: "b",
              operator: "eq",
              value: "1"
            }
          },
          actions: [{ type: "alert", message: { kind: "literal", value: "x" } }]
        }
      ];

      const kinds = getFieldEventTriggerKinds(rules);
      expect([...kinds].toSorted()).toEqual(["change", "click"]);
    });
  });

  describe("evaluateRuntimeStates", () => {
    it("derives one state per root-scope node, keyed by node id", () => {
      const states = evaluateRuntimeStates(statesSchema(), { status: "off" });

      expect(states.Field_target).toMatchObject({ hidden: true });
      expect(states.Field_status).toEqual({
        hidden: false,
        disabled: false,
        required: false,
        assigned: false
      });
      // The subform node itself lives in the root scope and gets an entry.
      expect(states.Sub_lines).toBeDefined();
    });

    it("skips subform-template nodes (rows are evaluated per row, not here)", () => {
      const states = evaluateRuntimeStates(statesSchema(), {});

      // Including the template would key every row's state under the one
      // shared template node id; the per-row controllers own that scope.
      expect(states.Field_row_note).toBeUndefined();
    });
  });

  describe("source tracking", () => {
    it("lists sources only for condition rules with a state action", () => {
      const field = makeField("target", {
        linkage: {
          rules: [
            {
              id: "Rule_state",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "a",
                  operator: "eq",
                  value: "1"
                }
              },
              actions: [{ type: "hide" }]
            },
            {
              id: "Rule_effect_only",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "b",
                  operator: "eq",
                  value: "1"
                }
              },
              actions: [{ type: "alert", message: { kind: "literal", value: "hi" } }]
            }
          ]
        }
      });

      // `a` drives derived state (re-validation); `b` only feeds an effect, so it
      // is not a validation dependency.
      expect(getLinkageSourceKeys(field)).toEqual(["a"]);
    });
  });

  describe("default helpers", () => {
    it("derives default values from keyed fields and initial values", () => {
      const schema = makeSchema([makeField("name"), makeField("code")]);

      expect(deriveDefaultValues(schema, { code: "A001" })).toEqual({
        name: "",
        code: "A001"
      });
    });

    it("treats nullish, empty strings, and empty arrays as empty values", () => {
      const empty: unknown = undefined;
      expect(isEmptyRuntimeValue(empty)).toBe(true);
      expect(isEmptyRuntimeValue(null)).toBe(true);
      expect(isEmptyRuntimeValue("")).toBe(true);
      expect(isEmptyRuntimeValue([])).toBe(true);
      expect(isEmptyRuntimeValue(false)).toBe(false);
      expect(isEmptyRuntimeValue(0)).toBe(false);
    });

    it("treats an all-blank array as empty so a cleared date range is not mistaken for filled", () => {
      // A RangePicker cleared back to `["", ""]` must read as empty for both
      // `required` and the `empty` / `notEmpty` operators.
      expect(isEmptyRuntimeValue(["", ""])).toBe(true);
      expect(isEmptyRuntimeValue([null, undefined])).toBe(true);
      expect(isEmptyRuntimeValue(["2026-01-01", ""])).toBe(false);
      expect(isEmptyRuntimeValue([0])).toBe(false);
      expect(isEmptyRuntimeValue(["a"])).toBe(false);
    });
  });

  describe("validateLinkageSchema", () => {
    const assignAction = { type: "assign", value: { kind: "literal", value: "x" } } as const;

    describe("default-hidden reachability", () => {
      it("warns when a default-hidden block has no show rule", () => {
        const schema = makeSchema([makeField("a", { linkage: { defaults: { hidden: true }, rules: [] } })]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "default_hidden_unreachable",
          path: "node[Field_a].linkage.defaults.hidden",
          severity: "warning"
        }));
      });

      it("stays silent when one of the block's rules can show it", () => {
        const schema = makeSchema([
          makeField("b"),
          makeField("a", {
            linkage: {
              defaults: { hidden: true },
              rules: [
                {
                  id: "Rule_1",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "leaf",
                      sourceKey: "b",
                      operator: "eq",
                      value: "1"
                    }
                  },
                  actions: [{ type: "show" }]
                }
              ]
            }
          })
        ]);

        expect(codesOf(validateLinkageSchema(schema).issues)).not.toContain("default_hidden_unreachable");
      });

      it("stays silent for a visible-by-default block", () => {
        const schema = makeSchema([makeField("a", { linkage: { rules: [] } })]);

        expect(codesOf(validateLinkageSchema(schema).issues)).not.toContain("default_hidden_unreachable");
      });
    });

    describe("malformed payloads", () => {
      it("flags a null rule entry instead of crashing", () => {
        const schema = makeSchema([makeField("a", { linkage: { rules: [null] } as unknown as FieldLinkage })]);

        const { issues } = validateLinkageSchema(schema);

        expect(issues).toContainEqual(expect.objectContaining({
          code: "rule_malformed",
          path: "node[Field_a].linkage.rules[0]",
          severity: "error"
        }));
      });

      it("flags a non-array rules payload", () => {
        const schema = makeSchema([makeField("a", { linkage: { rules: 42 } as unknown as FieldLinkage })]);

        expect(codesOf(validateLinkageSchema(schema).issues)).toContain("rules_not_array");
      });

      it("flags a non-object linkage payload", () => {
        const schema = makeSchema([makeField("a", { linkage: 42 as unknown as FieldLinkage })]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "linkage_malformed",
          path: "node[Field_a].linkage"
        }));
      });

      it("flags a null action under a condition trigger without crashing the state scan", () => {
        // The value-writing scan over `actions` must only see entries that
        // passed the object guard — `[null]` used to crash `isStateAction`.
        const schema = makeSchema([
          makeField("b"),
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: leafTrigger("b"),
                  actions: [null, { type: "hide" }]
                }
              ]
            } as unknown as FieldLinkage
          })
        ]);

        const { issues } = validateLinkageSchema(schema);

        expect(issues).toContainEqual(expect.objectContaining({
          code: "action_malformed",
          path: "node[Field_a].linkage.rules[0].actions[0]",
          ruleId: "Rule_1"
        }));
      });

      it("flags a condition trigger missing its condition and registers no edges", () => {
        // `{ kind: "condition" }` with no condition used to flow into the edge
        // collector and crash on `condition.kind`.
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "condition" },
                  actions: [assignAction]
                }
              ]
            } as unknown as FieldLinkage
          })
        ]);

        const { issues } = validateLinkageSchema(schema);

        expect(issues).toContainEqual(expect.objectContaining({
          code: "condition_malformed",
          path: "node[Field_a].linkage.rules[0].trigger.condition"
        }));
        expect(codesOf(issues)).not.toContain("cycle_detected");
      });

      it("flags a null trigger", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: null,
                  actions: [{ type: "submit" }]
                }
              ]
            } as unknown as FieldLinkage
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "trigger_malformed",
          path: "node[Field_a].linkage.rules[0].trigger"
        }));
      });

      it("flags an unknown condition kind", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "condition", condition: { kind: "weird" } },
                  actions: [{ type: "show" }]
                }
              ]
            } as unknown as FieldLinkage
          })
        ]);

        expect(codesOf(validateLinkageSchema(schema).issues)).toContain("condition_kind_invalid");
      });

      it("flags a malformed action value", () => {
        const schema = makeSchema([
          makeField("b"),
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: leafTrigger("b"),
                  actions: [{ type: "assign", value: 42 }]
                }
              ]
            } as unknown as FieldLinkage
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "value_malformed",
          path: "node[Field_a].linkage.rules[0].actions[0].value"
        }));
      });

      it("flags a missing rule id and still validates the rest of the rule", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [{ trigger: { kind: "change" }, actions: [{ type: "hide" }] }]
            } as unknown as FieldLinkage
          })
        ]);

        const { issues } = validateLinkageSchema(schema);

        expect(issues).toContainEqual(expect.objectContaining({
          code: "id_required",
          path: "node[Field_a].linkage.rules[0].id"
        }));
        expect(issues).toContainEqual(expect.objectContaining({ code: "state_action_on_edge_trigger" }));
      });
    });

    describe("structural rules", () => {
      it("rejects a change trigger on a non-keyed field", () => {
        // A non-keyed block (button / divider) has no onChange hook, so a `change`
        // trigger would never fire at runtime — reject it rather than no-op.
        const button: ButtonField = {
          id: "Btn",
          type: "button",
          label: "提交",
          linkage: {
            rules: [
              {
                id: "Rule_1",
                trigger: { kind: "change" },
                actions: [{ type: "alert", message: { kind: "literal", value: "x" } }]
              }
            ]
          }
        };

        expect(validateLinkageSchema(makeSchema([button])).issues).toContainEqual(expect.objectContaining({
          code: "trigger_requires_keyed_leaf",
          path: "node[Btn].linkage.rules[0].trigger.kind",
          severity: "error"
        }));
      });

      it("allows a change trigger on a keyed leaf field", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: [{ type: "alert", message: { kind: "literal", value: "x" } }]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });

      it("rejects an unknown leaf operator", () => {
        const schema = makeSchema([
          makeField("a"),
          makeField("b", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "leaf",
                      sourceKey: "a",
                      // @ts-expect-error — exercising the runtime validator
                      operator: "bogus"
                    }
                  },
                  actions: [{ type: "show" }]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "operator_invalid",
          path: "node[Field_b].linkage.rules[0].trigger.condition.operator"
        }));
      });

      it("rejects a keyed-only action on a non-keyed block", () => {
        const button: ButtonField = {
          id: "Field_btn",
          type: "button",
          linkage: {
            rules: [
              {
                id: "Rule_1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "src",
                    operator: "notEmpty"
                  }
                },
                actions: [{ type: "require" }]
              }
            ]
          }
        };
        const schema: RuntimeSchema = {
          id: "Form_1",
          children: [button, makeField("src")]
        };

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "action_requires_keyed_leaf",
          severity: "error"
        }));
      });

      it("rejects a state action on an edge (event) trigger", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: [{ type: "hide" }]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "state_action_on_edge_trigger",
          path: "node[Field_a].linkage.rules[0].actions[0].type",
          severity: "error"
        }));
      });

      it("rejects a form-lifecycle trigger on a field rule", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "load" },
                  actions: [{ type: "submit" }]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "trigger_kind_invalid",
          path: "node[Field_a].linkage.rules[0].trigger.kind"
        }));
      });

      it("rejects an unknown alert level", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "click" },
                  actions: [
                    {
                      type: "alert",
                      // @ts-expect-error — exercising the runtime validator
                      level: "fatal",
                      message: { kind: "literal", value: "x" }
                    }
                  ]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "alert_level_invalid",
          path: "node[Field_a].linkage.rules[0].actions[0].level"
        }));
      });

      it("rejects an unknown retrigger value", () => {
        const schema = makeSchema([
          makeField("b"),
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: leafTrigger("b"),
                  actions: [
                    {
                      type: "alert",
                      // @ts-expect-error — exercising the runtime validator
                      retrigger: "sometimes",
                      message: { kind: "literal", value: "x" }
                    }
                  ]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "retrigger_invalid",
          path: "node[Field_a].linkage.rules[0].actions[0].retrigger",
          severity: "error"
        }));
      });

      it("rejects an api_call with a non-string resource", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "click" },
                  actions: [{ type: "api_call", request: { resource: 42, action: "do" } }]
                }
              ]
            } as unknown as FieldLinkage
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "request_malformed",
          path: "node[Field_a].linkage.rules[0].actions[0].request.resource",
          severity: "error"
        }));
      });
    });

    describe("authoring warnings (round-trip)", () => {
      it("warns on an empty actions array", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: []
                }
              ]
            }
          })
        ]);

        const { issues } = validateLinkageSchema(schema);

        expect(issues).toContainEqual(expect.objectContaining({
          code: "actions_empty",
          severity: "warning"
        }));
        expect(issues.every(issue => issue.severity === "warning")).toBe(true);
      });

      it("warns on an empty condition group", () => {
        // The editor seeds an empty group when no sibling field exists yet.
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "group",
                      logic: "all",
                      children: []
                    }
                  },
                  actions: [{ type: "show" }]
                }
              ]
            }
          })
        ]);

        const { issues } = validateLinkageSchema(schema);

        expect(issues).toContainEqual(expect.objectContaining({
          code: "condition_group_empty",
          severity: "warning"
        }));
        expect(issues.every(issue => issue.severity === "warning")).toBe(true);
      });

      it("warns on an empty expression source", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "condition", condition: { kind: "expression", source: "" } },
                  actions: [{ type: "show" }]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "source_empty",
          severity: "warning"
        }));
      });

      it("warns on a set_field targeting an unknown key and carries the rule id", () => {
        // Deleting a field after a rule referenced it is legitimate
        // mid-authoring state — it must survive export → import.
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: [
                    {
                      type: "set_field",
                      targetKey: "ghost",
                      value: { kind: "literal", value: 1 }
                    }
                  ]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "target_key_unresolved",
          ruleId: "Rule_1",
          severity: "warning"
        }));
      });

      it("warns on an empty set_field target", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: [
                    {
                      type: "set_field",
                      targetKey: "",
                      value: { kind: "literal", value: "" }
                    }
                  ]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "target_key_empty",
          severity: "warning"
        }));
      });

      it("warns on a set_variable with a blank variable name", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: [
                    {
                      type: "set_variable",
                      variable: "",
                      value: { kind: "literal", value: 1 }
                    }
                  ]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "variable_empty",
          severity: "warning"
        }));
      });

      it("warns on a refresh_data_source with a blank data source id", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: [{ type: "refresh_data_source", dataSourceId: "" }]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "data_source_id_empty",
          severity: "warning"
        }));
      });

      it("accepts a refresh_data_source with a non-empty data source id", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: [{ type: "refresh_data_source", dataSourceId: "ds1" }]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });

      it("warns on an api_call with a blank resource", () => {
        // The editor seeds api_call with `{ resource: "", action: "" }`.
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "click" },
                  actions: [{ type: "api_call", request: { resource: "", action: "do" } }]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "request_incomplete",
          severity: "warning"
        }));
      });

      it("warns on a retrigger configured on an edge-triggered rule", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: [
                    {
                      type: "alert",
                      retrigger: "always",
                      message: { kind: "literal", value: "x" }
                    }
                  ]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "retrigger_ignored",
          severity: "warning"
        }));
      });

      it("accepts a retrigger on a condition-triggered effect", () => {
        const schema = makeSchema([
          makeField("b"),
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: leafTrigger("b"),
                  actions: [
                    {
                      type: "alert",
                      retrigger: "always",
                      message: { kind: "literal", value: "x" }
                    }
                  ]
                }
              ]
            }
          })
        ]);

        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });
    });

    describe("cycles and self-reference", () => {
      it("reports a cycle between mutually assigning fields", () => {
        const schema = makeSchema([
          fieldWithRule("a", "b", [assignAction]),
          fieldWithRule("b", "a", [assignAction])
        ]);

        const { issues } = validateLinkageSchema(schema);

        expect(issues).toContainEqual(expect.objectContaining({
          code: "cycle_detected",
          severity: "error",
          message: "联动规则存在循环依赖：b -> a -> b"
        }));
      });

      it("reports a three-node assign cycle with the full chain", () => {
        const schema = makeSchema([
          fieldWithRule("a", "b", [assignAction]),
          fieldWithRule("b", "c", [assignAction]),
          fieldWithRule("c", "a", [assignAction])
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "cycle_detected",
          message: "联动规则存在循环依赖：b -> a -> c -> b"
        }));
      });

      it("allows mutual references between level-stable state rules", () => {
        // a hides on b and b hides on a: nothing writes a value, so the state
        // fold is a pure function of the values — no feedback loop exists.
        const schema = makeSchema([
          fieldWithRule("a", "b", [{ type: "hide" }]),
          fieldWithRule("b", "a", [{ type: "hide" }])
        ]);

        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });

      it("allows a self-referential condition on a level-stable rule", () => {
        // "Require self while self is empty" reads the field's value without
        // writing it back — legal and useful.
        const field = makeField("a", {
          linkage: {
            rules: [
              {
                id: "Rule_1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "a",
                    operator: "empty"
                  }
                },
                actions: [{ type: "require" }]
              }
            ]
          }
        });

        expect(validateLinkageSchema(makeSchema([field])).issues).toEqual([]);
      });

      it("rejects a self-referential condition on an assign rule", () => {
        const schema = makeSchema([fieldWithRule("a", "a", [assignAction])]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "self_reference",
          path: "node[Field_a].linkage.rules[0].trigger.condition",
          severity: "error"
        }));
      });

      it("rejects a self-referential condition on a script rule", () => {
        const schema = makeSchema([fieldWithRule("a", "a", [{ type: "script", source: "return { value: 1 };" }])]);

        expect(codesOf(validateLinkageSchema(schema).issues)).toContain("self_reference");
      });

      it("rejects a set_field that always-retriggers into its own condition source", () => {
        // Reads `a`, writes `a`, re-fires on every `a` change while the
        // condition holds — the same unbounded loop as a self-assign, with a
        // statically known target.
        const schema = makeSchema([
          fieldWithRule("a", "a", [
            {
              type: "set_field",
              targetKey: "a",
              retrigger: "always",
              value: { kind: "literal", value: 1 }
            }
          ])
        ]);

        expect(codesOf(validateLinkageSchema(schema).issues)).toContain("self_reference");
      });

      it("reports a cycle between mutually always-retriggering set_field rules", () => {
        const schema = makeSchema([
          fieldWithRule("a", "b", [setFieldAlways("a")]),
          fieldWithRule("b", "a", [setFieldAlways("b")])
        ]);

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "cycle_detected",
          severity: "error"
        }));
      });

      it("allows a rising-edge set_field back into its own condition source", () => {
        // The default retrigger fires once per false→true transition and
        // settles — no edge, no error.
        const schema = makeSchema([
          fieldWithRule("a", "a", [
            {
              type: "set_field",
              targetKey: "a",
              value: { kind: "literal", value: 1 }
            }
          ])
        ]);

        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });

      it("allows a self-referential source key on an effect-only rule", () => {
        const schema = makeSchema([fieldWithRule("a", "a", [{ type: "alert", message: { kind: "literal", value: "self" } }])]);

        // "when my own value == x → alert" is legitimate; no self-reference error.
        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });

      it("does not build a state edge for an effect-only condition rule", () => {
        // a→b and b→a, but both are effect-only condition rules — no state cycle.
        const schema = makeSchema([
          fieldWithRule("a", "b", [{ type: "alert", message: { kind: "literal", value: "x" } }]),
          fieldWithRule("b", "a", [{ type: "alert", message: { kind: "literal", value: "y" } }])
        ]);

        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });

      it("keeps identical keys in different scopes out of each other's cycles", () => {
        // Root `a` assigns from root `b`; row-scope `b` assigns from row-scope
        // `a`. Without `scope::key` namespacing these edges would join into a
        // false a ↔ b cycle.
        const schema: RuntimeSchema = {
          id: "Form_1",
          children: [
            makeField("b"),
            fieldWithRule("a", "b", [assignAction]),
            {
              id: "Sub_1",
              type: "subform",
              variant: "stack",
              key: "lines",
              template: [
                makeField("a", { id: "Field_row_a" }),
                makeField("b", {
                  id: "Field_row_b",
                  linkage: {
                    rules: [
                      {
                        id: "Rule_row_b",
                        trigger: leafTrigger("a"),
                        actions: [assignAction]
                      }
                    ]
                  }
                })
              ]
            }
          ]
        };

        expect(codesOf(validateLinkageSchema(schema).issues)).not.toContain("cycle_detected");
      });

      it("strips the scope prefix from keys in a subform-scope cycle message", () => {
        const schema: RuntimeSchema = {
          id: "Form_1",
          children: [
            {
              id: "Sub_1",
              type: "subform",
              variant: "stack",
              key: "lines",
              template: [
                makeField("x", {
                  id: "Field_row_x",
                  linkage: {
                    rules: [
                      {
                        id: "Rule_x",
                        trigger: leafTrigger("y"),
                        actions: [assignAction]
                      }
                    ]
                  }
                }),
                makeField("y", {
                  id: "Field_row_y",
                  linkage: {
                    rules: [
                      {
                        id: "Rule_y",
                        trigger: leafTrigger("x"),
                        actions: [assignAction]
                      }
                    ]
                  }
                })
              ]
            }
          ]
        };

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "cycle_detected",
          message: "联动规则存在循环依赖：y -> x -> y"
        }));
      });
    });

    describe("set_field targeting", () => {
      it("accepts a set_field targeting an existing same-scope key", () => {
        const schema = makeSchema([
          makeField("a", {
            linkage: {
              rules: [
                {
                  id: "Rule_1",
                  trigger: { kind: "change" },
                  actions: [
                    {
                      type: "set_field",
                      targetKey: "b",
                      value: { kind: "literal", value: 1 }
                    }
                  ]
                }
              ]
            }
          }),
          makeField("b")
        ]);

        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });

      it("accepts a set_field targeting a subform key (wholesale row reset)", () => {
        // Assigning an array value to a subform key is the documented way to
        // reset its rows; the runtime applies it like any other key.
        const schema: RuntimeSchema = {
          id: "Form_1",
          children: [
            makeField("a", {
              linkage: {
                rules: [
                  {
                    id: "Rule_1",
                    trigger: { kind: "change" },
                    actions: [
                      {
                        type: "set_field",
                        targetKey: "lines",
                        value: { kind: "literal", value: [] }
                      }
                    ]
                  }
                ]
              }
            }),
            {
              id: "Sub_1",
              type: "subform",
              variant: "stack",
              key: "lines",
              template: [makeField("amount", { id: "Field_row_amount" })]
            }
          ]
        };

        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });
    });

    describe("subform template scoping", () => {
      it("resolves a subform-template rule's source within its own scope", () => {
        const schema: RuntimeSchema = {
          id: "Form_1",
          children: [
            {
              id: "Sub_1",
              type: "subform",
              variant: "stack",
              key: "lines",
              template: [
                makeField("category"),
                makeField("note", {
                  linkage: {
                    rules: [
                      {
                        id: "Rule_1",
                        trigger: {
                          kind: "condition",
                          condition: {
                            kind: "leaf",
                            sourceKey: "category",
                            operator: "eq",
                            value: "other"
                          }
                        },
                        actions: [{ type: "show" }]
                      }
                    ]
                  }
                })
              ]
            }
          ]
        };

        expect(validateLinkageSchema(schema).issues).toEqual([]);
      });

      it("warns on a subform-template rule referencing a key from the outer scope", () => {
        const schema: RuntimeSchema = {
          id: "Form_1",
          children: [
            makeField("rootField"),
            {
              id: "Sub_1",
              type: "subform",
              variant: "stack",
              key: "lines",
              template: [
                makeField("note", {
                  linkage: {
                    rules: [
                      {
                        id: "Rule_1",
                        trigger: {
                          kind: "condition",
                          condition: {
                            kind: "leaf",
                            sourceKey: "rootField",
                            operator: "notEmpty"
                          }
                        },
                        actions: [{ type: "show" }]
                      }
                    ]
                  }
                })
              ]
            }
          ]
        };

        expect(validateLinkageSchema(schema).issues).toContainEqual(expect.objectContaining({
          code: "source_key_unresolved",
          severity: "warning"
        }));
      });
    });
  });

  describe("form-scope linkage", () => {
    // The form-scope linkage rides as the second argument; the layer carries
    // the root fields it resolves against.
    const layer = makeSchema([makeField("amount")]);

    function validateForm(linkage: FieldLinkage): ReturnType<typeof validateLinkageSchema> {
      return validateLinkageSchema(layer, linkage);
    }

    it("accepts a lifecycle rule carrying an effect action", () => {
      const result = validateForm({
        rules: [
          {
            id: "F1",
            trigger: { kind: "afterSubmit" },
            actions: [{ type: "alert", message: { kind: "literal", value: "done" } }]
          }
        ]
      });

      expect(result.issues).toEqual([]);
    });

    it("accepts a form-wide condition rule resolved against root fields", () => {
      const result = validateForm({
        rules: [
          {
            id: "F1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "amount",
                operator: "gt",
                value: 0
              }
            },
            actions: [{ type: "navigate", to: { kind: "literal", value: "/ok" } }]
          }
        ]
      });

      expect(result.issues).toEqual([]);
    });

    it("rejects a field-event trigger at form scope", () => {
      const result = validateForm({
        rules: [
          {
            id: "F1",
            trigger: { kind: "change" },
            actions: [{ type: "submit" }]
          }
        ]
      });

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "trigger_kind_invalid",
        path: "schema.linkage.rules[0].trigger.kind"
      }));
    });

    it("rejects a state action on a form-scope condition rule", () => {
      const result = validateForm({
        rules: [
          {
            id: "F1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "amount",
                operator: "gt",
                value: 0
              }
            },
            actions: [{ type: "hide" }]
          }
        ]
      });

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "state_action_on_form_scope",
        severity: "error"
      }));
    });

    it("rejects defaults at form scope (the form has no self field)", () => {
      const result = validateForm({ defaults: { hidden: true } });

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "defaults_on_form_scope",
        path: "schema.linkage.defaults",
        severity: "error"
      }));
    });
  });
});
