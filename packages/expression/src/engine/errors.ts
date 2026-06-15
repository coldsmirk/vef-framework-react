/**
 * Error raised when the ZEN engine fails to load or an expression cannot be
 * evaluated. The original failure is preserved on {@link cause} and the
 * offending expression (if any) on {@link expression}.
 */
export class ExpressionError extends Error {
  readonly expression?: string;

  constructor(message: string, expression?: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ExpressionError";
    this.expression = expression;
  }
}

/**
 * Raised by the synchronous evaluation helpers when the engine has not finished
 * initializing yet. Await {@link loadEngine} (or render under
 * `<ExpressionEngineProvider>`) before evaluating synchronously.
 */
export class ExpressionNotReadyError extends ExpressionError {
  constructor(
    message = "Expression engine is not initialized. Await loadEngine() or render under <ExpressionEngineProvider>."
  ) {
    super(message);
    this.name = "ExpressionNotReadyError";
  }
}
