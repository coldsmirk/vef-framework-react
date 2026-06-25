import { ExpressionNotReadyError } from "./errors";
import {
  evaluate,
  evaluateSync,
  evaluateUnary,
  evaluateUnarySync,
  validate,
  validateUnary
} from "./evaluate";
import { loadEngine, resetEngine } from "./loader";

const zen = vi.hoisted(() => {
  return {
    init: vi.fn(),
    evaluateExpression: vi.fn(),
    evaluateUnaryExpression: vi.fn(),
    validateExpression: vi.fn(),
    validateUnaryExpression: vi.fn(),
    isReady: vi.fn()
  };
});

vi.mock("@gorules/zen-engine-wasm", () => {
  return {
    default: zen.init,
    evaluateExpression: zen.evaluateExpression,
    evaluateUnaryExpression: zen.evaluateUnaryExpression,
    validateExpression: zen.validateExpression,
    validateUnaryExpression: zen.validateUnaryExpression,
    isReady: zen.isReady
  };
});

beforeEach(() => {
  resetEngine();
  vi.clearAllMocks();
  zen.init.mockResolvedValue({});
  zen.isReady.mockReturnValue(true);
});

describe("evaluate", () => {
  it("loads the engine and returns the computed value", async () => {
    zen.evaluateExpression.mockReturnValue(180);

    await expect(evaluate("price * qty", { price: 90, qty: 2 })).resolves.toBe(180);
  });

  it("passes the context through to the engine", async () => {
    zen.evaluateExpression.mockReturnValue(1);

    await evaluate("a", { a: 1 });

    expect(zen.evaluateExpression).toHaveBeenCalledWith("a", { a: 1 });
  });

  it("wraps an engine throw in an ExpressionError carrying the expression", async () => {
    zen.evaluateExpression.mockImplementation(() => {
      throw new Error("bad expression");
    });

    await expect(evaluate("$$$")).rejects.toMatchObject({ name: "ExpressionError", expression: "$$$" });
  });
});

describe("evaluateUnary", () => {
  it("returns the boolean result", async () => {
    zen.evaluateUnaryExpression.mockReturnValue(true);

    await expect(evaluateUnary("> 100", { $: 150 })).resolves.toBe(true);
  });
});

describe("evaluateSync", () => {
  it("throws ExpressionNotReadyError before the engine loads", () => {
    expect(() => evaluateSync("1 + 1")).toThrow(ExpressionNotReadyError);
  });

  it("evaluates once the engine is ready", async () => {
    zen.evaluateExpression.mockReturnValue(2);
    await loadEngine();

    expect(evaluateSync("1 + 1")).toBe(2);
  });
});

describe("evaluateUnarySync", () => {
  it("throws ExpressionNotReadyError before the engine loads", () => {
    expect(() => evaluateUnarySync("> 0")).toThrow(ExpressionNotReadyError);
  });

  it("evaluates once the engine is ready", async () => {
    zen.evaluateUnaryExpression.mockReturnValue(false);
    await loadEngine();

    expect(evaluateUnarySync("> 0")).toBe(false);
  });
});

describe("validate", () => {
  it("returns the engine diagnostic payload", async () => {
    zen.validateExpression.mockReturnValue(null);

    await expect(validate("1 + 1")).resolves.toBeNull();
  });
});

describe("validateUnary", () => {
  it("returns the engine diagnostic payload", async () => {
    const diagnostic = { isValid: true };
    zen.validateUnaryExpression.mockReturnValue(diagnostic);

    await expect(validateUnary("> 0")).resolves.toBe(diagnostic);
  });
});
