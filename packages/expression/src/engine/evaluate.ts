import type { ExpressionContext } from "./loader";

import { getEngineSync, loadEngine } from "./loader";

/**
 * Evaluate a standard ZEN expression, loading the engine on first use.
 *
 * `T` is an **unchecked** assertion — the value is returned as `T` with no
 * runtime validation, and ZEN's result type depends on the expression and
 * context. Prefer the `unknown` default and narrow at the call site.
 */
export async function evaluate<T = unknown>(expression: string, context?: ExpressionContext): Promise<T> {
  const engine = await loadEngine();
  return engine.evaluate<T>(expression, context);
}

/**
 * Evaluate a ZEN unary (test) expression, loading the engine on first use.
 */
export async function evaluateUnary(expression: string, context?: ExpressionContext): Promise<boolean> {
  const engine = await loadEngine();
  return engine.evaluateUnary(expression, context);
}

/**
 * Evaluate a standard ZEN expression synchronously. Throws
 * {@link ExpressionNotReadyError} when the engine has not loaded yet — use this
 * only behind a readiness gate (e.g. under `<ExpressionEngineProvider>`).
 */
export function evaluateSync<T = unknown>(expression: string, context?: ExpressionContext): T {
  return getEngineSync().evaluate<T>(expression, context);
}

/**
 * Evaluate a ZEN unary (test) expression synchronously. Throws
 * {@link ExpressionNotReadyError} when the engine has not loaded yet.
 */
export function evaluateUnarySync(expression: string, context?: ExpressionContext): boolean {
  return getEngineSync().evaluateUnary(expression, context);
}

/**
 * Validate a standard expression, loading the engine on first use.
 */
export async function validate(expression: string): Promise<unknown> {
  const engine = await loadEngine();
  return engine.validate(expression);
}

/**
 * Validate a unary expression, loading the engine on first use.
 */
export async function validateUnary(expression: string): Promise<unknown> {
  const engine = await loadEngine();
  return engine.validateUnary(expression);
}

/**
 * Return ZEN completion metadata, loading the engine on first use.
 */
export async function getCompletions(): Promise<unknown> {
  const engine = await loadEngine();
  return engine.getCompletions();
}
