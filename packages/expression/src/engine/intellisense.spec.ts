import { ExpressionNotReadyError } from "./errors";
import {
  analyzeTypesSync,
  extractPosition,
  getCompletionItemsSync,
  getDiagnosticsSync,
  normalizeCompletions,
  normalizeDiagnostic,
  satisfiesTypeSync
} from "./intellisense";
import { loadEngine, resetEngine } from "./loader";
import { setExpressionLocale } from "./messages";

const zen = vi.hoisted(() => {
  const state = {
    rootKind: "Any" as unknown,
    typeCheck: [] as unknown[],
    typeCheckUnary: [] as unknown[],
    satisfies: true
  };
  const free = vi.fn();

  return {
    state,
    free,
    init: vi.fn(),
    validateExpression: vi.fn(),
    validateUnaryExpression: vi.fn(),
    getCompletions: vi.fn(),
    isReady: vi.fn(),
    VariableType: {
      fromJson: vi.fn((json: unknown) => {
        return {
          toJson: () => state.rootKind ?? json,
          typeCheck: () => state.typeCheck,
          typeCheckUnary: () => state.typeCheckUnary,
          satisfies: () => state.satisfies,
          free
        };
      })
    }
  };
});

vi.mock("@gorules/zen-engine-wasm", () => {
  return {
    default: zen.init,
    validateExpression: zen.validateExpression,
    validateUnaryExpression: zen.validateUnaryExpression,
    getCompletions: zen.getCompletions,
    isReady: zen.isReady,
    VariableType: zen.VariableType
  };
});

beforeEach(() => {
  resetEngine();
  vi.clearAllMocks();
  setExpressionLocale("en-US");
  zen.init.mockResolvedValue({});
  zen.isReady.mockReturnValue(true);
  zen.validateExpression.mockReturnValue(null);
  zen.validateUnaryExpression.mockReturnValue(null);
  zen.getCompletions.mockReturnValue([]);
  zen.state.rootKind = "Any";
  zen.state.typeCheck = [];
  zen.state.typeCheckUnary = [];
  zen.state.satisfies = true;
});

describe("extractPosition", () => {
  it("parses a parenthesized range", () => {
    expect(extractPosition("Unexpected token at (3, 5)")).toEqual([3, 5]);
  });

  it("parses a single offset", () => {
    expect(extractPosition("Bad token at 7")).toBe(7);
  });

  it("returns null when there is no position", () => {
    expect(extractPosition("Incomplete parser output")).toBeNull();
  });

  it("returns null when the position is not numeric", () => {
    expect(extractPosition("Weird at (oops)")).toBeNull();
  });
});

describe("normalizeDiagnostic", () => {
  it("returns null for a valid expression", () => {
    expect(normalizeDiagnostic(null, "1 + 1")).toBeNull();
  });

  it("maps a positioned parser error to a diagnostic", () => {
    expect(normalizeDiagnostic({ type: "parserError", source: "Unexpected end of unary expression at (3, 3)" }, "1 +"))
      .toEqual({
        from: 3,
        to: 3,
        message: "Unexpected end of unary expression at (3, 3)",
        source: "Parser error"
      });
  });

  it("falls back to the whole source when the error has no position", () => {
    expect(normalizeDiagnostic({ type: "parserError", source: "Incomplete parser output" }, "a b c"))
      .toEqual({
        from: 0,
        to: 5,
        message: "Incomplete parser output",
        source: "Parser error"
      });
  });

  it("labels an unknown error type generically", () => {
    expect(normalizeDiagnostic({ type: "mystery", source: "boom" }, "x")?.source).toBe("Error");
  });
});

describe("normalizeCompletions", () => {
  it("returns an empty list for a non-array payload", () => {
    expect(normalizeCompletions(null)).toEqual([]);
  });

  it("strips backticks from the detail signature", () => {
    const [item] = normalizeCompletions([
      {
        type: "function",
        label: "len",
        detail: "(var: `string`) -> number",
        info: "Length",
        boost: 10,
        methodFor: null
      }
    ]);

    expect(item?.detail).toBe("(var: string) -> number");
  });

  it("drops entries without a label", () => {
    expect(normalizeCompletions([{ type: "function" }, { type: "variable", label: "$" }])).toHaveLength(1);
  });

  it("defaults an unrecognized type to function", () => {
    const [item] = normalizeCompletions([{ type: "keyword", label: "and" }]);

    expect(item?.type).toBe("function");
  });

  it("preserves a method's methodFor link", () => {
    const [item] = normalizeCompletions([
      {
        type: "method",
        label: "add",
        methodFor: "Date"
      }
    ]);

    expect(item).toMatchObject({
      type: "method",
      label: "add",
      methodFor: "Date"
    });
  });
});

describe("getDiagnosticsSync", () => {
  it("throws when the engine has not loaded", () => {
    expect(() => getDiagnosticsSync("1 + 1", "standard")).toThrow(ExpressionNotReadyError);
  });

  it("returns null for a valid standard expression", async () => {
    await loadEngine();

    expect(getDiagnosticsSync("1 + 1", "standard")).toBeNull();
  });

  it("validates a unary expression through the unary path", async () => {
    await loadEngine();
    zen.validateUnaryExpression.mockReturnValue({ type: "parserError", source: "Expected a literal at (7, 7)" });

    expect(getDiagnosticsSync("and and", "unary")).toEqual({
      from: 7,
      to: 7,
      message: "Expected a literal at (7, 7)",
      source: "Parser error"
    });
    expect(zen.validateExpression).not.toHaveBeenCalled();
  });
});

describe("getCompletionItemsSync", () => {
  it("normalizes the wasm completion payload", async () => {
    await loadEngine();
    zen.getCompletions.mockReturnValue([
      {
        type: "function",
        label: "len",
        detail: "(v) -> number",
        info: "Length",
        boost: 10,
        methodFor: null
      }
    ]);

    expect(getCompletionItemsSync()).toEqual([
      {
        type: "function",
        label: "len",
        detail: "(v) -> number",
        info: "Length",
        boost: 10,
        methodFor: null
      }
    ]);
  });
});

describe("analyzeTypesSync", () => {
  it("returns the root kind and per-span types for a standard expression", async () => {
    await loadEngine();
    zen.state.rootKind = { Object: { amount: "Number" } };
    zen.state.typeCheck = [
      {
        error: null,
        kind: "Number",
        nodeKind: "Identifier",
        span: [0, 6]
      }
    ];

    expect(analyzeTypesSync({ Object: { amount: "Number" } }, "amount", "standard")).toEqual({
      rootKind: { Object: { amount: "Number" } },
      spans: [
        {
          error: null,
          kind: "Number",
          nodeKind: "Identifier",
          span: [0, 6]
        }
      ]
    });
    expect(zen.free).toHaveBeenCalledTimes(1);
  });

  it("type-checks a unary expression through the unary path", async () => {
    await loadEngine();
    zen.state.typeCheckUnary = [
      {
        error: null,
        kind: "Bool",
        nodeKind: "Binary",
        span: [0, 11]
      }
    ];

    expect(analyzeTypesSync({ Object: {} }, "amount > 10", "unary").spans[0]?.kind).toBe("Bool");
  });

  it("coerces a non-array type-check result to an empty span list", async () => {
    await loadEngine();
    zen.state.typeCheck = null as unknown as unknown[];

    expect(analyzeTypesSync({ Object: {} }, "amount", "standard").spans).toEqual([]);
  });
});

describe("satisfiesTypeSync", () => {
  it("delegates to the engine and frees both operands", async () => {
    await loadEngine();
    zen.state.satisfies = false;

    expect(satisfiesTypeSync("Number", "Bool")).toBe(false);
    expect(zen.free).toHaveBeenCalledTimes(2);
  });
});

describe("localization", () => {
  it("translates a completion description under zh-CN", async () => {
    await loadEngine();
    setExpressionLocale("zh-CN");
    zen.getCompletions.mockReturnValue([
      {
        type: "function",
        label: "floor",
        detail: "(num: number) -> number",
        info: "Rounds a number down to the nearest integer.",
        boost: null,
        methodFor: null
      }
    ]);

    expect(getCompletionItemsSync()[0]?.info).toBe("向下取整到最接近的整数。");
  });

  it("keeps the function signature English under zh-CN", async () => {
    await loadEngine();
    setExpressionLocale("zh-CN");
    zen.getCompletions.mockReturnValue([
      {
        type: "function",
        label: "floor",
        detail: "(num: number) -> number",
        info: "Rounds a number down to the nearest integer.",
        boost: null,
        methodFor: null
      }
    ]);

    expect(getCompletionItemsSync()[0]?.detail).toBe("(num: number) -> number");
  });

  it("translates a diagnostic source label under zh-CN", () => {
    setExpressionLocale("zh-CN");

    expect(normalizeDiagnostic({ type: "parserError", source: "Incomplete parser output" }, "a b c")?.source).toBe("语法错误");
  });
});
