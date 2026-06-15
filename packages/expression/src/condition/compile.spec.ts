import type { ExpressionEngine } from "../engine/loader";
import type { ConditionBranchInput, ConditionInput, ConditionOperator, FieldConditionInput } from "./types";

import { compileBranch, compileCondition, compileGroup, selectBranchWith, toZenLiteral } from "./compile";

function fieldCondition(partial: Partial<FieldConditionInput> = {}): FieldConditionInput {
  return {
    kind: "field",
    subject: "amount",
    operator: "eq",
    value: 0,
    ...partial
  };
}

type FakeEngine = Pick<ExpressionEngine, "evaluate" | "validate">;

function fakeEngine(evaluate: FakeEngine["evaluate"], validate: FakeEngine["validate"] = vi.fn(() => null)): FakeEngine {
  return { evaluate, validate };
}

describe("toZenLiteral", () => {
  it("emits numbers verbatim", () => {
    expect(toZenLiteral(42)).toBe("42");
  });

  it("emits booleans verbatim", () => {
    expect(toZenLiteral(true)).toBe("true");
  });

  it("emits bigints verbatim", () => {
    expect(toZenLiteral(10n)).toBe("10");
  });

  it("single-quotes a plain string", () => {
    expect(toZenLiteral("active")).toBe("'active'");
  });

  it("double-quotes a string containing a single quote (ZEN literals are raw, no escapes)", () => {
    expect(toZenLiteral("it's")).toBe("\"it's\"");
  });

  it("single-quotes a string containing a double quote", () => {
    expect(toZenLiteral("say \"hi\"")).toBe("'say \"hi\"'");
  });

  it("leaves backslashes raw rather than escaping them", () => {
    expect(toZenLiteral(String.raw`C:\Users`)).toBe(String.raw`'C:\Users'`);
  });

  it("throws for a string containing both quote styles (no raw ZEN representation)", () => {
    expect(() => toZenLiteral("a'b\"c")).toThrow();
  });

  it("emits null for nullish values", () => {
    const undefinedValue: unknown = undefined;

    expect(toZenLiteral(null)).toBe("null");
    expect(toZenLiteral(undefinedValue)).toBe("null");
  });

  it("emits array literals", () => {
    expect(toZenLiteral(["a", "b"])).toBe("['a', 'b']");
  });

  it("emits an empty array literal", () => {
    expect(toZenLiteral([])).toBe("[]");
  });

  it("throws for an object value (no ZEN literal representation)", () => {
    expect(() => toZenLiteral({ k: 1 })).toThrow();
  });
});

describe("compileCondition", () => {
  it("compiles eq to a ZEN equality", () => {
    expect(compileCondition(fieldCondition({ operator: "eq", value: 5 }))).toBe("amount == 5");
  });

  it("compiles ne to a ZEN inequality", () => {
    expect(compileCondition(fieldCondition({ operator: "ne", value: 5 }))).toBe("amount != 5");
  });

  it("compiles gt to a ZEN comparison", () => {
    expect(compileCondition(fieldCondition({ operator: "gt", value: 1000 }))).toBe("amount > 1000");
  });

  it("compiles gte to a ZEN comparison", () => {
    expect(compileCondition(fieldCondition({ operator: "gte", value: 1000 }))).toBe("amount >= 1000");
  });

  it("compiles lt to a ZEN comparison", () => {
    expect(compileCondition(fieldCondition({ operator: "lt", value: 1000 }))).toBe("amount < 1000");
  });

  it("compiles lte to a ZEN comparison", () => {
    expect(compileCondition(fieldCondition({ operator: "lte", value: 1000 }))).toBe("amount <= 1000");
  });

  it("compiles contains to the ZEN contains() function", () => {
    expect(compileCondition(fieldCondition({
      subject: "tags",
      operator: "contains",
      value: "vip"
    })))
      .toBe("contains(tags, 'vip')");
  });

  it("compiles not_contains to a negated contains()", () => {
    expect(compileCondition(fieldCondition({
      subject: "tags",
      operator: "not_contains",
      value: "vip"
    })))
      .toBe("not contains(tags, 'vip')");
  });

  it("compiles starts_with to startsWith()", () => {
    expect(compileCondition(fieldCondition({
      subject: "code",
      operator: "starts_with",
      value: "PRE"
    })))
      .toBe("startsWith(code, 'PRE')");
  });

  it("compiles ends_with to endsWith()", () => {
    expect(compileCondition(fieldCondition({
      subject: "code",
      operator: "ends_with",
      value: "SUF"
    })))
      .toBe("endsWith(code, 'SUF')");
  });

  it("compiles in to ZEN membership over an array", () => {
    expect(compileCondition(fieldCondition({
      subject: "city",
      operator: "in",
      value: ["BJ", "SH"]
    })))
      .toBe("city in ['BJ', 'SH']");
  });

  it("wraps a single value into an array for in", () => {
    expect(compileCondition(fieldCondition({
      subject: "city",
      operator: "in",
      value: "BJ"
    })))
      .toBe("city in ['BJ']");
  });

  it("compiles not_in to a negated membership", () => {
    expect(compileCondition(fieldCondition({
      subject: "city",
      operator: "not_in",
      value: ["BJ"]
    })))
      .toBe("not (city in ['BJ'])");
  });

  it("wraps a single value into an array for not_in", () => {
    expect(compileCondition(fieldCondition({
      subject: "city",
      operator: "not_in",
      value: "BJ"
    })))
      .toBe("not (city in ['BJ'])");
  });

  it("compiles is_empty to the typed emptiness test", () => {
    expect(compileCondition(fieldCondition({ subject: "note", operator: "is_empty" })))
      .toBe("(note == null or (type(note) == 'string' and len(trim(note)) == 0) or (type(note) == 'array' and len(note) == 0))");
  });

  it("compiles is_not_empty to the negated typed emptiness test", () => {
    expect(compileCondition(fieldCondition({ subject: "note", operator: "is_not_empty" })))
      .toBe("not (note == null or (type(note) == 'string' and len(trim(note)) == 0) or (type(note) == 'array' and len(note) == 0))");
  });

  it("passes an expression-kind condition through verbatim", () => {
    const condition: ConditionInput = {
      kind: "expression",
      expression: "amount > 1000 and status == 'active'"
    };

    expect(compileCondition(condition)).toBe("amount > 1000 and status == 'active'");
  });

  it("returns null for an empty expression-kind condition", () => {
    expect(compileCondition({ kind: "expression", expression: "  " })).toBeNull();
  });

  it("returns null for an empty subject", () => {
    expect(compileCondition(fieldCondition({ subject: "  " }))).toBeNull();
  });

  it("returns null for a value with no ZEN representation", () => {
    expect(compileCondition(fieldCondition({ operator: "eq", value: { nested: true } }))).toBeNull();
  });

  it("returns null for an operator forced past the type at runtime", () => {
    const condition: ConditionInput = {
      kind: "field",
      subject: "amount",
      operator: "between" as ConditionOperator,
      value: 5
    };

    expect(compileCondition(condition)).toBeNull();
  });

  it("allows dotted and indexed subject paths", () => {
    expect(compileCondition(fieldCondition({
      subject: "user.age",
      operator: "gt",
      value: 18
    })))
      .toBe("user.age > 18");
    expect(compileCondition(fieldCondition({
      subject: "items[0]",
      operator: "eq",
      value: 1
    })))
      .toBe("items[0] == 1");
  });

  it("returns null for a subject that is not an identifier path (injection guard)", () => {
    expect(compileCondition(fieldCondition({ subject: "amount == amount or len(secret) > 0" }))).toBeNull();
    expect(compileCondition(fieldCondition({ subject: "len(secret)" }))).toBeNull();
  });
});

describe("compileGroup", () => {
  it("joins a group's conditions with AND", () => {
    expect(compileGroup({
      conditions: [
        fieldCondition({
          subject: "amount",
          operator: "gt",
          value: 1000
        }),
        fieldCondition({
          subject: "level",
          operator: "eq",
          value: "vip"
        })
      ]
    }))
      .toBe("amount > 1000 and level == 'vip'");
  });

  it("drops non-compiling conditions and keeps the valid ones", () => {
    expect(compileGroup({
      conditions: [
        fieldCondition({ subject: "len(secret)" }),
        fieldCondition({
          subject: "amount",
          operator: "gt",
          value: 1000
        })
      ]
    }))
      .toBe("amount > 1000");
  });

  it("returns null when no condition compiles", () => {
    expect(compileGroup({
      conditions: [
        fieldCondition({ subject: "len(secret)" }),
        fieldCondition({ operator: "between" as ConditionOperator })
      ]
    }))
      .toBeNull();
  });
});

describe("compileBranch", () => {
  it("joins a group's conditions with AND", () => {
    const branch: ConditionBranchInput = {
      id: "b1",
      priority: 1,
      conditionGroups: [
        {
          conditions: [
            fieldCondition({
              subject: "amount",
              operator: "gt",
              value: 1000
            }),
            fieldCondition({
              subject: "level",
              operator: "eq",
              value: "vip"
            })
          ]
        }
      ]
    };

    expect(compileBranch(branch)).toBe("(amount > 1000 and level == 'vip')");
  });

  it("joins multiple groups with OR", () => {
    const branch: ConditionBranchInput = {
      id: "b1",
      priority: 1,
      conditionGroups: [
        {
          conditions: [
            fieldCondition({
              subject: "amount",
              operator: "gt",
              value: 1000
            })
          ]
        },
        {
          conditions: [
            fieldCondition({
              subject: "urgent",
              operator: "eq",
              value: true
            })
          ]
        }
      ]
    };

    expect(compileBranch(branch)).toBe("(amount > 1000) or (urgent == true)");
  });

  it("drops a group that does not compile", () => {
    const branch: ConditionBranchInput = {
      id: "b1",
      priority: 1,
      conditionGroups: [
        { conditions: [fieldCondition({ subject: "len(secret)" })] },
        {
          conditions: [
            fieldCondition({
              subject: "amount",
              operator: "gt",
              value: 1000
            })
          ]
        }
      ]
    };

    expect(compileBranch(branch)).toBe("(amount > 1000)");
  });

  it("returns null for a branch with no condition groups", () => {
    expect(compileBranch({
      id: "d",
      priority: 99,
      isDefault: true
    })).toBeNull();
  });
});

describe("selectBranchWith", () => {
  const branches: ConditionBranchInput[] = [
    {
      id: "default",
      priority: 99,
      isDefault: true
    },
    {
      id: "big",
      priority: 1,
      conditionGroups: [
        {
          conditions: [
            fieldCondition({
              subject: "amount",
              operator: "gt",
              value: 1000
            })
          ]
        }
      ]
    }
  ];

  it("returns the first matching non-default branch by priority", () => {
    const engine = fakeEngine(vi.fn().mockReturnValue(true));

    expect(selectBranchWith(branches, { amount: 1500 }, engine)).toEqual({ branchId: "big", matched: true });
    expect(engine.evaluate).toHaveBeenCalledWith("(amount > 1000)", { amount: 1500 });
  });

  it("falls back to the default branch when nothing matches", () => {
    const engine = fakeEngine(vi.fn().mockReturnValue(false));

    expect(selectBranchWith(branches, { amount: 500 }, engine)).toEqual({ branchId: "default", matched: false });
  });

  it("returns a null branch id when nothing matches and there is no default", () => {
    const engine = fakeEngine(vi.fn().mockReturnValue(false));
    const noDefault: ConditionBranchInput[] = [
      {
        id: "big",
        priority: 1,
        conditionGroups: [
          {
            conditions: [
              fieldCondition({
                subject: "amount",
                operator: "gt",
                value: 1000
              })
            ]
          }
        ]
      }
    ];

    expect(selectBranchWith(noDefault, { amount: 500 }, engine)).toEqual({ branchId: null, matched: false });
  });

  it("treats a non-boolean truthy result as no match", () => {
    const engine = fakeEngine(vi.fn().mockReturnValue(1));

    expect(selectBranchWith(branches, { amount: 1500 }, engine)).toEqual({ branchId: "default", matched: false });
  });

  it("treats a branch whose expression throws as not matching", () => {
    const engine = fakeEngine(vi.fn(() => {
      throw new Error("Opcode Compare: Unsupported type");
    }));

    expect(selectBranchWith(branches, { amount: null }, engine)).toEqual({ branchId: "default", matched: false });
  });
});

describe("evaluatesTrue diagnostics", () => {
  const branch: ConditionBranchInput = {
    id: "raw",
    priority: 1,
    conditionGroups: [{ conditions: [{ kind: "expression", expression: "amount >" }] }]
  };

  it("warns when a compiled expression fails to parse (an emitter bug, not a runtime mismatch)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      // swallow the dev diagnostic under test
    });
    const engine = fakeEngine(
      vi.fn(() => {
        throw new Error("parse failed");
      }),
      vi.fn().mockReturnValue({ type: "parserError" })
    );

    selectBranchWith([branch], {}, engine);

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("stays silent when the expression parses but throws at runtime (the degrade-to-default path)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      // swallow the dev diagnostic under test
    });
    const engine = fakeEngine(
      vi.fn(() => {
        throw new Error("Opcode Compare: Unsupported type");
      }),
      vi.fn().mockReturnValue(null)
    );

    selectBranchWith([branch], {}, engine);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
