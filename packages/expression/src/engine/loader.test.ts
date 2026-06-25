import { ExpressionError, ExpressionNotReadyError } from "./errors";
import { configureEngine, getEngineError, getEngineSync, isEngineReady, loadEngine, resetEngine } from "./loader";

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

describe("loadEngine", () => {
  it("initializes the wasm engine once across concurrent calls", async () => {
    const [first, second] = await Promise.all([loadEngine(), loadEngine()]);

    expect(zen.init).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("returns the cached instance on a later call", async () => {
    const first = await loadEngine();
    const second = await loadEngine();

    expect(second).toBe(first);
    expect(zen.init).toHaveBeenCalledTimes(1);
  });

  describe("when initialization fails", () => {
    it("rejects with an ExpressionError", async () => {
      zen.init.mockRejectedValueOnce(new Error("boom"));

      await expect(loadEngine()).rejects.toBeInstanceOf(ExpressionError);
    });

    it("clears the cached promise so a later call retries", async () => {
      zen.init.mockRejectedValueOnce(new Error("boom"));
      await expect(loadEngine()).rejects.toBeInstanceOf(ExpressionError);

      const engine = await loadEngine();

      expect(engine.isReady()).toBe(true);
      expect(zen.init).toHaveBeenCalledTimes(2);
    });

    it("exposes the failure via getEngineError and clears it on a successful retry", async () => {
      zen.init.mockRejectedValueOnce(new Error("boom"));
      await expect(loadEngine()).rejects.toBeInstanceOf(ExpressionError);

      expect(getEngineError()).toBeInstanceOf(ExpressionError);

      await loadEngine();

      expect(getEngineError()).toBeNull();
    });
  });
});

describe("configureEngine", () => {
  it("passes the configured wasm input to the initializer", async () => {
    const wasmInput = new URL("https://cdn.example/zen.wasm");
    configureEngine({ wasmInput });

    await loadEngine();

    expect(zen.init).toHaveBeenCalledWith({ module_or_path: wasmInput });
  });

  it("initializes with undefined when not configured", async () => {
    await loadEngine();

    expect(zen.init).toHaveBeenCalledWith(undefined);
  });

  it("throws when called after the engine has loaded", async () => {
    await loadEngine();

    expect(() => configureEngine({ wasmInput: new URL("https://cdn.example/other.wasm") })).toThrow(ExpressionError);
  });
});

describe("isEngineReady", () => {
  it("is false before the engine loads", () => {
    expect(isEngineReady()).toBe(false);
  });

  it("is true once the engine loads", async () => {
    await loadEngine();

    expect(isEngineReady()).toBe(true);
  });
});

describe("getEngineSync", () => {
  it("throws ExpressionNotReadyError before the engine loads", () => {
    expect(() => getEngineSync()).toThrow(ExpressionNotReadyError);
  });

  it("returns the engine after it loads", async () => {
    await loadEngine();

    expect(getEngineSync().isReady()).toBe(true);
  });
});
