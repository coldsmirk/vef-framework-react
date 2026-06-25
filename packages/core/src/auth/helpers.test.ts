import { describe, expect, it, vi } from "vitest";

import { checkPermission } from "./helpers";

const grantEdit = (token: string) => token === "edit";

describe("auth/checkPermission", () => {
  describe("when no permission is required", () => {
    it("grants access without consulting hasPermission when requiredPermissions is omitted", () => {
      const hasPermission = vi.fn();

      const result = checkPermission(hasPermission);

      expect(result).toBe(true);
      expect(hasPermission).not.toHaveBeenCalled();
    });
  });

  describe("when a single token is required", () => {
    it("grants access when the user holds the token", () => {
      const hasPermission = vi.fn((token: string) => token === "edit");

      const result = checkPermission(hasPermission, "edit");

      expect(result).toBe(true);
      expect(hasPermission).toHaveBeenCalledTimes(1);
      expect(hasPermission).toHaveBeenCalledWith("edit");
    });

    it("denies access when the user lacks the token", () => {
      const hasPermission = vi.fn(() => false);

      const result = checkPermission(hasPermission, "edit");

      expect(result).toBe(false);
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });

    it("treats a single string and a single-element array identically", () => {
      const fromString = checkPermission(grantEdit, "edit");
      const fromArray = checkPermission(grantEdit, ["edit"]);

      expect(fromString).toBe(true);
      expect(fromArray).toBe(true);
    });
  });

  describe("when multiple tokens are required in \"any\" mode", () => {
    it("grants access when the user holds at least one token", () => {
      const hasPermission = vi.fn((token: string) => token === "delete");

      const result = checkPermission(hasPermission, ["edit", "delete", "view"], "any");

      expect(result).toBe(true);
    });

    it("denies access when the user holds none of the tokens", () => {
      const hasPermission = vi.fn(() => false);

      const result = checkPermission(hasPermission, ["edit", "delete"], "any");

      expect(result).toBe(false);
      expect(hasPermission).toHaveBeenCalledTimes(2);
    });

    it("short-circuits after the first matching token", () => {
      const hasPermission = vi.fn((token: string) => token === "edit");

      checkPermission(hasPermission, ["edit", "delete", "view"], "any");

      expect(hasPermission).toHaveBeenCalledTimes(1);
      expect(hasPermission).toHaveBeenCalledWith("edit");
    });

    it("defaults to \"any\" mode when checkMode is omitted", () => {
      const withDefault = checkPermission(grantEdit, ["edit", "delete"]);
      const withExplicit = checkPermission(grantEdit, ["edit", "delete"], "any");

      expect(withDefault).toBe(withExplicit);
      expect(withDefault).toBe(true);
    });
  });

  describe("when multiple tokens are required in \"all\" mode", () => {
    it("grants access when the user holds every token", () => {
      const owned = new Set(["edit", "delete"]);
      const hasPermission = vi.fn((token: string) => owned.has(token));

      const result = checkPermission(hasPermission, ["edit", "delete"], "all");

      expect(result).toBe(true);
      expect(hasPermission).toHaveBeenCalledTimes(2);
    });

    it("denies access when the user is missing any token", () => {
      const hasPermission = vi.fn((token: string) => token === "edit");

      const result = checkPermission(hasPermission, ["edit", "delete"], "all");

      expect(result).toBe(false);
    });

    it("short-circuits after the first missing token", () => {
      const hasPermission = vi.fn(() => false);

      checkPermission(hasPermission, ["edit", "delete", "view"], "all");

      expect(hasPermission).toHaveBeenCalledTimes(1);
      expect(hasPermission).toHaveBeenCalledWith("edit");
    });
  });

  describe("with an empty token list", () => {
    it("denies access in \"any\" mode because no token can satisfy the check", () => {
      const hasPermission = vi.fn();

      const result = checkPermission(hasPermission, [], "any");

      expect(result).toBe(false);
      expect(hasPermission).not.toHaveBeenCalled();
    });

    it("grants access in \"all\" mode by vacuous truth", () => {
      const hasPermission = vi.fn();

      const result = checkPermission(hasPermission, [], "all");

      expect(result).toBe(true);
      expect(hasPermission).not.toHaveBeenCalled();
    });
  });
});
