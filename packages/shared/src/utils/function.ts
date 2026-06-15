import type { Awaitable, MaybeUndefined } from "../types";

export interface AwaitableFnInvocationOptions<in TResult, in out TContext = unknown> {
  onInvoke?: () => MaybeUndefined<TContext>;
  onSuccess?: (result: TResult, context: MaybeUndefined<TContext>) => void;
  onError?: (error: unknown, context: MaybeUndefined<TContext>) => void;
  onFinally?: (context: MaybeUndefined<TContext>) => void;
}

/**
 * Checks if a function is an async function.
 */
export function isAsyncFunction(fn: Function): fn is (...args: any[]) => Promise<any> {
  const constructorName = fn.constructor.name;
  return constructorName === "AsyncFunction" || constructorName === "AsyncGeneratorFunction";
}

/**
 * Invokes an awaitable function with lifecycle hooks.
 */
export async function invokeAwaitableFn<TArgs extends any[] = any[], TResult = unknown, TContext = unknown>(
  fn: (...args: TArgs) => Awaitable<TResult>,
  args: NoInfer<TArgs>,
  options: AwaitableFnInvocationOptions<NoInfer<TResult>, TContext>
): Promise<TResult> {
  const {
    onInvoke,
    onSuccess,
    onError,
    onFinally
  } = options;
  const returned = fn(...args);

  if (!(returned instanceof Promise)) {
    return returned;
  }

  const context = onInvoke?.();

  try {
    const result = await returned;
    onSuccess?.(result, context);
    return result;
  } catch (error) {
    onError?.(error, context);
    throw error;
  } finally {
    onFinally?.(context);
  }
}

/**
 * Returns the value itself (identity function).
 */
export function identity<T>(value: T): T {
  return value;
}

/**
 * Creates a function that throws a not-implemented error.
 */
export function createThrowNotImplementedFn(feature?: string): () => never {
  return () => throwNotImplemented(feature);
}

/**
 * Throws a not-implemented error.
 */
export function throwNotImplemented(feature?: string): never {
  const message = feature ? `${feature} not implemented` : "Not implemented";
  throw new Error(message);
}
