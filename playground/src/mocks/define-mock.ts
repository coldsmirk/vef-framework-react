/**
 * Mock registry for the playground's RPC envelope.
 *
 * Every mock module calls `defineMock(resource, action, handler)` at import
 * time to register a fake implementation. The HTTP handler in `handlers.ts`
 * receives the wire envelope (`{ resource, action, version, params, meta }`),
 * looks up the corresponding registered handler, and returns whatever it
 * produces wrapped in the framework's `ApiResult` shape.
 */

export interface MockContext<P = unknown, M = unknown> {
  params: P;
  meta: M | undefined;
  version: string;
}

export type MockHandler<P, R> = (ctx: MockContext<P>) => Promise<R> | R;

/**
 * Thrown by a mock handler to surface a non-OK business code without
 * resorting to native exceptions (which would map to `9998` by default).
 */
export class MockBusinessError extends Error {
  readonly code: number;
  readonly data: unknown;

  constructor(code: number, message: string, data: unknown = null) {
    super(message);
    this.name = "MockBusinessError";
    this.code = code;
    this.data = data;
  }
}

const registry = new Map<string, MockHandler<never, unknown>>();

function buildKey(resource: string, action: string): string {
  return `${resource}::${action}`;
}

export function defineMock<P = unknown, R = unknown>(
  resource: string,
  action: string,
  handler: MockHandler<P, R>
): void {
  const key = buildKey(resource, action);

  if (registry.has(key)) {
    console.warn(`[mocks] handler already registered for "${key}"; overriding`);
  }

  registry.set(key, handler as MockHandler<never, unknown>);
}

export function resolveMock(resource: string, action: string): MockHandler<never, unknown> | undefined {
  return registry.get(buildKey(resource, action));
}
