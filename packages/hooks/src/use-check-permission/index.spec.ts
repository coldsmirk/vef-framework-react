import { describe, expect, it } from "vitest";

import { renderHook } from "../../test-utils";
import { useCheckPermission } from "./index";

function permissionGate(allowed: ReadonlySet<string>): (token: string) => boolean {
  return token => allowed.has(token);
}

describe("hooks/useCheckPermission", () => {
  it("returns true when the user holds the required permission", () => {
    const appContext = { hasPermission: permissionGate(new Set(["user:read"])) };

    const { result } = renderHook(() => useCheckPermission(), { appContext });

    expect(result.current("user:read")).toBe(true);
  });

  it("returns false when the user lacks the required permission", () => {
    const appContext = { hasPermission: permissionGate(new Set(["user:read"])) };

    const { result } = renderHook(() => useCheckPermission(), { appContext });

    expect(result.current("user:write")).toBe(false);
  });

  it("treats no required permissions as 'permission granted'", () => {
    const appContext = { hasPermission: permissionGate(new Set()) };

    const { result } = renderHook(() => useCheckPermission(), { appContext });

    expect(result.current()).toBe(true);
  });

  it("falls back to allow-all when hasPermission is omitted from the app context", () => {
    const { result } = renderHook(() => useCheckPermission(), { appContext: {} });

    expect(result.current("any:token")).toBe(true);
  });

  describe("array tokens", () => {
    it("requires every token in 'all' mode", () => {
      const appContext = { hasPermission: permissionGate(new Set(["user:read"])) };

      const { result } = renderHook(() => useCheckPermission(), { appContext });

      expect(result.current(["user:read", "user:write"], "all")).toBe(false);
      expect(result.current(["user:read"], "all")).toBe(true);
    });

    it("requires any matching token in 'any' mode", () => {
      const appContext = { hasPermission: permissionGate(new Set(["user:read"])) };

      const { result } = renderHook(() => useCheckPermission(), { appContext });

      expect(result.current(["user:read", "user:write"], "any")).toBe(true);
      expect(result.current(["user:admin", "user:write"], "any")).toBe(false);
    });
  });
});
