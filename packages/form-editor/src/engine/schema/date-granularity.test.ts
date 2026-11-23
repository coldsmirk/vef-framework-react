import type { DateField, FormSchema } from "../../types";

import { describe, expect, it } from "vitest";

import {
  applyDateGranularityToField,
  hasAuthoredDateLiteralsInSchema,
  reconcileDateGranularityInSchema
} from "./date-granularity";

function makeSchemaWithDateLiterals(): FormSchema {
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
              type: "set_field",
              targetKey: "period",
              value: { kind: "literal", value: "2026-04-15" }
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
                  id: "r-assign",
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
          {
            id: "T1",
            type: "textfield",
            key: "note",
            label: "备注",
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
                      type: "set_field",
                      targetKey: "period",
                      value: { kind: "literal", value: "2026-05-01" }
                    },
                    {
                      type: "set_field",
                      targetKey: "period",
                      value: { kind: "expression", source: "'2026-05'" }
                    }
                  ]
                }
              ]
            }
          }
        ]
      },
      mobile: {
        children: [
          {
            id: "MD1",
            type: "date",
            key: "period",
            label: "期间"
          }
        ]
      }
    }
  };
}

describe("date-granularity reconciliation", () => {
  it("detects authored linkage literals targeting the date field across the scope", () => {
    const schema = makeSchemaWithDateLiterals();
    const field = schema.presentations.pc.children[0] as DateField;

    expect(hasAuthoredDateLiteralsInSchema(schema, field)).toBe(true);

    const clean: FormSchema = {
      id: "Form_clean",
      version: 2,
      presentations: {
        pc: {
          children: [
            {
              id: "D1",
              type: "date",
              key: "period",
              label: "期间"
            }
          ]
        }
      }
    };

    expect(hasAuthoredDateLiteralsInSchema(clean, clean.presentations.pc.children[0] as DateField)).toBe(false);
  });

  it("switches granularity, syncs the cross-device twin, and scrubs incompatible linkage literals", () => {
    const schema = makeSchemaWithDateLiterals();
    const next = reconcileDateGranularityInSchema(schema, "D1", "month");

    const pcDate = next.presentations.pc.children[0] as DateField;
    const pcNote = next.presentations.pc.children[1];
    const mobileDate = next.presentations.mobile?.children[0] as DateField;

    expect(pcDate.granularity).toBe("month");
    expect(mobileDate.granularity).toBe("month");

    // Own assign literal and self condition literal scrubbed.
    const ownRule = pcDate.linkage?.rules?.[0];

    expect(ownRule?.actions[0]).toEqual({ type: "assign", value: { kind: "literal", value: "" } });
    expect(ownRule?.trigger.kind === "condition" && ownRule.trigger.condition.kind === "group"
      ? ownRule.trigger.condition.children[0]
      : undefined).toMatchObject({ sourceKey: "period", value: "" });

    // Sibling condition literal and set_field literal scrubbed; expression action kept.
    const siblingRule = pcNote?.linkage?.rules?.[0];

    expect(siblingRule?.trigger.kind === "condition" && siblingRule.trigger.condition.kind === "group"
      ? siblingRule.trigger.condition.children[0]
      : undefined).toMatchObject({ sourceKey: "period", value: "" });
    expect(siblingRule?.actions[1]).toEqual({
      type: "set_field",
      targetKey: "period",
      value: { kind: "literal", value: "" }
    });
    expect(siblingRule?.actions[2]).toEqual({
      type: "set_field",
      targetKey: "period",
      value: { kind: "expression", source: "'2026-05'" }
    });

    // Root form-level linkage literal scrubbed.
    expect(next.linkage?.rules?.[0]?.actions[0]).toEqual({
      type: "set_field",
      targetKey: "period",
      value: { kind: "literal", value: "" }
    });
  });

  it("drops the granularity key when switching back to default day", () => {
    const field: DateField = {
      id: "D1",
      type: "date",
      key: "period",
      granularity: "quarter"
    };

    const updated = applyDateGranularityToField(field, "day");

    expect("granularity" in updated).toBe(false);
  });
});
