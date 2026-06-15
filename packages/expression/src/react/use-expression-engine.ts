import type { ExpressionEngine } from "../engine/loader";

import { use } from "react";

import { ExpressionEngineContext } from "./context";

/**
 * Return the initialized {@link ExpressionEngine}. Must be rendered under
 * `<ExpressionEngineProvider>`, which suspends until the wasm engine is ready —
 * so the returned engine is always safe to evaluate against synchronously.
 */
export function useExpressionEngine(): ExpressionEngine {
  const engine = use(ExpressionEngineContext);

  if (!engine) {
    throw new Error("useExpressionEngine must be used within <ExpressionEngineProvider>.");
  }

  return engine;
}
