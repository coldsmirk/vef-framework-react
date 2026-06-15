import type { ConditionBranchInput } from "./types";

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { evaluateSync } from "../engine/evaluate";
import { configureEngine, loadEngine, resetEngine } from "../engine/loader";
import { compileCondition, selectBranch, toZenLiteral } from "./compile";

// These specs load the REAL ZEN wasm engine and parse the compiler's emitted
// source through it. This is the regression guard the mocked unit specs cannot
// give: the string-encoder defect shipped precisely because every other spec
// mocks the engine and never exercises the real ZEN parser.

const require = createRequire(import.meta.url);

function roundTrips(value: unknown): boolean {
  return evaluateSync(`subject == ${toZenLiteral(value)}`, { subject: value }) === true;
}

beforeAll(async () => {
  resetEngine();

  const entry = require.resolve("@gorules/zen-engine-wasm");
  const wasmPath = entry.replace(/index\.js$/, "dist/zen_engine_wasm_bg.wasm");
  const wasmBytes = await readFile(wasmPath);

  configureEngine({ wasmInput: wasmBytes });
  await loadEngine();
});

afterAll(() => {
  resetEngine();
});

describe("toZenLiteral output parsed by the real ZEN engine", () => {
  it("round-trips a plain string", () => {
    expect(roundTrips("active")).toBe(true);
  });

  it("round-trips a string containing a single quote", () => {
    expect(roundTrips("O'Brien")).toBe(true);
  });

  it("round-trips a string containing a double quote", () => {
    expect(roundTrips("say \"hi\"")).toBe(true);
  });

  it("round-trips a string containing a backslash", () => {
    expect(roundTrips(String.raw`C:\Users\me`)).toBe(true);
  });

  it("round-trips a number", () => {
    expect(roundTrips(1500)).toBe(true);
  });

  it("round-trips array membership", () => {
    expect(evaluateSync("subject in ['BJ', 'SH']", { subject: "BJ" })).toBe(true);
  });
});

describe("selectBranch with the loaded engine", () => {
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
            {
              kind: "field",
              subject: "amount",
              operator: "gt",
              value: 1000
            }
          ]
        }
      ]
    }
  ];

  it("selects the matching non-default branch", async () => {
    expect(await selectBranch(branches, { amount: 1500 })).toEqual({ branchId: "big", matched: true });
  });

  it("falls back to the default branch when nothing matches", async () => {
    expect(await selectBranch(branches, { amount: 500 })).toEqual({ branchId: "default", matched: false });
  });
});

// Mirrors the backend field evaluator's isEmptyValue: null / missing,
// whitespace-only text, and empty arrays are empty; numbers, booleans,
// and non-blank text are not.
function evaluateIsEmpty(subject?: unknown): unknown {
  const expression = compileCondition({
    kind: "field",
    subject: "subject",
    operator: "is_empty",
    value: undefined
  });

  if (expression === null) {
    throw new Error("is_empty condition should compile");
  }

  return evaluateSync(expression, { subject });
}

describe("is_empty semantics on the real engine", () => {
  it("treats null and a missing field as empty", () => {
    expect(evaluateIsEmpty(null)).toBe(true);
    expect(evaluateIsEmpty()).toBe(true);
  });

  it("treats whitespace-only text as empty", () => {
    expect(evaluateIsEmpty("   ")).toBe(true);
    expect(evaluateIsEmpty("")).toBe(true);
  });

  it("treats an empty array as empty", () => {
    expect(evaluateIsEmpty([])).toBe(true);
  });

  it("treats real values as non-empty", () => {
    expect(evaluateIsEmpty("x")).toBe(false);
    expect(evaluateIsEmpty(["a"])).toBe(false);
    expect(evaluateIsEmpty(0)).toBe(false);
    expect(evaluateIsEmpty(false)).toBe(false);
  });
});
