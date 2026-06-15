/**
 * Exhaustiveness guard for closed discriminated unions. Placing
 * `assertNever(x)` in a switch's `default` turns a future un-handled union
 * member into a compile error (the argument stops being `never`), and throws
 * loudly if an out-of-contract value reaches it at runtime.
 *
 * Use this only where the value is provably in-contract by the time the default
 * is reachable (e.g. behind a runtime type guard). On a path that may see
 * untrusted input, prefer {@link exhaustive}, which degrades to a no-op.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

/**
 * Compile-time-only exhaustiveness check. Like {@link assertNever} it makes a
 * missing union case a compile error, but it does **not** throw — so it is safe
 * in a switch over data that may be malformed at runtime (e.g. an imported
 * schema on the public render path): an unexpected value is simply ignored.
 */
export function exhaustive(_value: never): void {
  // Intentionally empty — the parameter type does the work at compile time.
}
