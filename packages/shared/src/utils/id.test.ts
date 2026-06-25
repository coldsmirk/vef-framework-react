import { describe, expect, it } from "vitest";

import { generateId } from "..";

describe("utils/id", () => {
  describe("generateId", () => {
    it("returns a 16-character lowercase alphanumeric string", () => {
      // Format guarantees URL-safe, DOM-safe, DB-safe and data-structure-key
      // usage simultaneously, so a single shape assertion subsumes the older
      // per-environment checks.
      const id = generateId();

      expect(id).toMatch(/^[a-z0-9]{16}$/);
    });

    it("returns different IDs on consecutive calls", () => {
      expect(generateId()).not.toBe(generateId());
    });

    it("returns unique IDs across a batch", () => {
      const ids = Array.from({ length: 100 }, () => generateId());

      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
