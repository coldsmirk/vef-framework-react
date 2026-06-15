import { describe, expect, it } from "vitest";

import { renderHook } from "../../test-utils";
import { useIsAuthorized } from "./index";

function permissionGate(allowed: ReadonlySet<string>): (token: string) => boolean {
  return token => allowed.has(token);
}

describe("hooks/useIsAuthorized", () => {
  it("returns true when the user holds the required permission", () => {
    const appContext = { hasPermission: permissionGate(new Set(["billing:view"])) };

    const { result } = renderHook(() => useIsAuthorized("billing:view"), { appContext });

    expect(result.current).toBe(true);
  });

  it("returns false when the user lacks the required permission", () => {
    const appContext = { hasPermission: permissionGate(new Set(["billing:view"])) };

    const { result } = renderHook(() => useIsAuthorized("billing:write"), { appContext });

    expect(result.current).toBe(false);
  });

  it("returns true when called without any required permission", () => {
    const appContext = { hasPermission: permissionGate(new Set()) };

    const { result } = renderHook(() => useIsAuthorized(), { appContext });

    expect(result.current).toBe(true);
  });

  it("falls back to allow-all when hasPermission is omitted from the app context", () => {
    const { result } = renderHook(() => useIsAuthorized("any:token"), { appContext: {} });

    expect(result.current).toBe(true);
  });

  it("supports 'all' mode requiring every listed token", () => {
    const appContext = { hasPermission: permissionGate(new Set(["a", "b"])) };

    const { result: allowed } = renderHook(
      () => useIsAuthorized(["a", "b"], "all"),
      { appContext }
    );
    const { result: blocked } = renderHook(
      () => useIsAuthorized(["a", "c"], "all"),
      { appContext }
    );

    expect(allowed.current).toBe(true);
    expect(blocked.current).toBe(false);
  });

  it("supports 'any' mode requiring at least one listed token", () => {
    const appContext = { hasPermission: permissionGate(new Set(["a"])) };

    const { result: allowed } = renderHook(
      () => useIsAuthorized(["a", "b"], "any"),
      { appContext }
    );
    const { result: blocked } = renderHook(
      () => useIsAuthorized(["b", "c"], "any"),
      { appContext }
    );

    expect(allowed.current).toBe(true);
    expect(blocked.current).toBe(false);
  });
});
