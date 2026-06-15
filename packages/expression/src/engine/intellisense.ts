import type { VariableTypeJson } from "@gorules/zen-engine-wasm";

import { getEngineSync, loadEngine } from "./loader";
import { localizeCompletionInfo, localizeSourceLabel } from "./messages";

/**
 * Whether an expression is a standard value expression or a unary (test) expression.
 */
export type ExpressionMode = "standard" | "unary";

/**
 * A ZEN type descriptor — the shape the engine understands for type-aware
 * completion and validation. Structurally identical to the wasm
 * `VariableTypeJson`: a primitive (`"String"`, `"Number"`, `"Bool"`, ...) or one
 * of `{ Object }`, `{ Array }`, `{ Const }`, `{ Enum }`.
 */
export type ExpressionType = VariableTypeJson;

/**
 * A single syntax / type diagnostic, positioned by character offset.
 */
export interface ExpressionDiagnostic {
  /**
   * Start offset in the source.
   */
  from: number;
  /**
   * End offset in the source.
   */
  to: number;
  /**
   * Human-readable error message.
   */
  message: string;
  /**
   * Diagnostic origin label (e.g. `"Parser error"`).
   */
  source: string;
}

/**
 * An autocomplete suggestion for a ZEN built-in (function / method / variable).
 */
export interface ExpressionCompletion {
  type: "function" | "method" | "variable";
  label: string;
  detail: string;
  info: string;
  boost: number | null;
  /**
   * For methods, the type-kind they attach to (e.g. `"Date"`); otherwise `null`.
   */
  methodFor: string | null;
}

/**
 * The inferred type of one span of the source, produced by type-checking.
 */
export interface ExpressionTypeSpan {
  error: string | null;
  kind: ExpressionType;
  nodeKind: string;
  span: [number, number];
}

/**
 * The result of type-checking an expression against a variable context.
 */
export interface ExpressionAnalysis {
  /**
   * The root context type (the variables object).
   */
  rootKind: ExpressionType;
  /**
   * Per-span inferred types; `spans[0]` is the whole-expression result type.
   */
  spans: ExpressionTypeSpan[];
}

interface RawExpressionError {
  type?: string;
  source?: string;
}

/**
 * Parse a trailing `... at (from, to)` / `... at pos` position out of a ZEN error
 * message. Returns a `[from, to]` range, a single offset, or `null` when absent.
 */
export function extractPosition(message: string): [number, number] | number | null {
  const segments = message.split(" at ");
  const last = segments.length <= 1 ? undefined : segments.at(-1);

  if (last === undefined) {
    return null;
  }

  const [left, right] = last.replace("(", "").replace(")", "").split(", ");
  const from = left === undefined ? Number.NaN : Number.parseInt(left, 10);

  if (Number.isNaN(from)) {
    return null;
  }

  if (right === undefined) {
    return from;
  }

  const to = Number.parseInt(right, 10);
  return Number.isNaN(to) ? from : [from, to];
}

/**
 * Normalize the wasm validate payload (`null` or `{ type, source }`) into a
 * positioned {@link ExpressionDiagnostic}, or `null` when the expression is valid.
 */
export function normalizeDiagnostic(raw: unknown, source: string): ExpressionDiagnostic | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const error = raw as RawExpressionError;
  const message = typeof error.source === "string" ? error.source : String(raw);
  const position = extractPosition(message);
  const [from, to] = position === null
    ? [0, source.length]
    : typeof position === "number"
      ? [position, position]
      : position;

  return {
    from,
    to,
    message,
    source: localizeSourceLabel(error.type)
  };
}

/**
 * Normalize the wasm `getCompletions` payload into a typed list, dropping
 * malformed entries and stripping the backtick markers ZEN wraps type names in.
 */
export function normalizeCompletions(raw: unknown): ExpressionCompletion[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry): ExpressionCompletion[] => {
    const item = entry as Partial<ExpressionCompletion>;

    if (typeof item.label !== "string" || item.label === "") {
      return [];
    }

    return [
      {
        type: item.type === "method" || item.type === "variable" ? item.type : "function",
        label: item.label,
        detail: typeof item.detail === "string" ? item.detail.replaceAll("`", "") : "",
        info: localizeCompletionInfo(typeof item.info === "string" ? item.info : ""),
        boost: typeof item.boost === "number" ? item.boost : null,
        methodFor: typeof item.methodFor === "string" ? item.methodFor : null
      }
    ];
  });
}

/**
 * Validate an expression, loading the engine on first use. Resolves to `null`
 * when the expression is valid, or a positioned diagnostic otherwise.
 */
export async function getDiagnostics(expression: string, mode: ExpressionMode): Promise<ExpressionDiagnostic | null> {
  const engine = await loadEngine();
  return normalizeDiagnostic(mode === "unary" ? engine.validateUnary(expression) : engine.validate(expression), expression);
}

/**
 * Synchronous {@link getDiagnostics}. Throws `ExpressionNotReadyError` if the
 * engine has not loaded yet — use only behind a readiness gate.
 */
export function getDiagnosticsSync(expression: string, mode: ExpressionMode): ExpressionDiagnostic | null {
  const engine = getEngineSync();
  return normalizeDiagnostic(mode === "unary" ? engine.validateUnary(expression) : engine.validate(expression), expression);
}

/**
 * Return the ZEN built-in completion list, loading the engine on first use.
 */
export async function getCompletionItems(): Promise<ExpressionCompletion[]> {
  const engine = await loadEngine();
  return normalizeCompletions(engine.getCompletions());
}

/**
 * Synchronous {@link getCompletionItems}. Throws `ExpressionNotReadyError` if the
 * engine has not loaded yet.
 */
export function getCompletionItemsSync(): ExpressionCompletion[] {
  return normalizeCompletions(getEngineSync().getCompletions());
}

/**
 * Type-check an expression against a `variables` context, loading the engine on
 * first use. See {@link ExpressionAnalysis}.
 */
export async function analyzeTypes(
  variables: ExpressionType,
  source: string,
  mode: ExpressionMode
): Promise<ExpressionAnalysis> {
  const engine = await loadEngine();
  return engine.analyze(variables, source, mode === "unary");
}

/**
 * Synchronous {@link analyzeTypes}. Throws `ExpressionNotReadyError` if the
 * engine has not loaded yet.
 */
export function analyzeTypesSync(variables: ExpressionType, source: string, mode: ExpressionMode): ExpressionAnalysis {
  return getEngineSync().analyze(variables, source, mode === "unary");
}

/**
 * Whether `actual` satisfies (is assignable to) `expected`, loading the engine on
 * first use. Used for expected-return-type validation.
 */
export async function satisfiesType(actual: ExpressionType, expected: ExpressionType): Promise<boolean> {
  const engine = await loadEngine();
  return engine.satisfies(actual, expected);
}

/**
 * Synchronous {@link satisfiesType}. Throws `ExpressionNotReadyError` if the
 * engine has not loaded yet.
 */
export function satisfiesTypeSync(actual: ExpressionType, expected: ExpressionType): boolean {
  return getEngineSync().satisfies(actual, expected);
}
