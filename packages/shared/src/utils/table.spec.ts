import { describe, expect, it } from "vitest";

import { shouldUpdateByKeys } from "..";

describe("utils/table", () => {
  describe("shouldUpdateByKeys", () => {
    describe("without options (reference comparison)", () => {
      it("returns false when all specified keys are equal", () => {
        const checker = shouldUpdateByKeys("id", "name");
        const prev = {
          id: 1,
          name: "test",
          age: 20
        };
        const next = {
          id: 1,
          name: "test",
          age: 25
        };

        expect(checker(next, prev)).toBe(false);
      });

      it("returns true when any specified key differs", () => {
        const checker = shouldUpdateByKeys("id", "name");
        const prev = { id: 1, name: "test" };
        const next = { id: 1, name: "changed" };

        expect(checker(next, prev)).toBe(true);
      });

      it("uses reference comparison for objects by default", () => {
        const checker = shouldUpdateByKeys("config");
        const config = { a: 1 };
        const prev = { config };
        const next = { config };

        expect(checker(next, prev)).toBe(false);

        const nextWithNewRef = { config: { a: 1 } };
        expect(checker(nextWithNewRef, prev)).toBe(true);
      });

      it("handles single key", () => {
        const checker = shouldUpdateByKeys("id");
        expect(checker({ id: 1 }, { id: 1 })).toBe(false);
        expect(checker({ id: 2 }, { id: 1 })).toBe(true);
      });
    });

    describe("with shallow comparison", () => {
      it("returns false for objects with same shallow properties", () => {
        const checker = shouldUpdateByKeys({ compare: "shallow" }, "config");
        const prev = { config: { a: 1, b: 2 } };
        const next = { config: { a: 1, b: 2 } };

        expect(checker(next, prev)).toBe(false);
      });

      it("returns true for objects with different shallow properties", () => {
        const checker = shouldUpdateByKeys({ compare: "shallow" }, "config");
        const prev = { config: { a: 1 } };
        const next = { config: { a: 2 } };

        expect(checker(next, prev)).toBe(true);
      });

      it("returns true for nested object changes", () => {
        const checker = shouldUpdateByKeys({ compare: "shallow" }, "config");
        const prev = { config: { nested: { a: 1 } } };
        const next = { config: { nested: { a: 1 } } };

        // Shallow comparison doesn't compare nested objects deeply
        expect(checker(next, prev)).toBe(true);
      });
    });

    describe("with deep comparison", () => {
      it("returns false for deeply equal objects", () => {
        const checker = shouldUpdateByKeys({ compare: "deep" }, "config");
        const prev = { config: { nested: { a: 1, b: [1, 2, 3] } } };
        const next = { config: { nested: { a: 1, b: [1, 2, 3] } } };

        expect(checker(next, prev)).toBe(false);
      });

      it("returns true for deeply different objects", () => {
        const checker = shouldUpdateByKeys({ compare: "deep" }, "config");
        const prev = { config: { nested: { a: 1 } } };
        const next = { config: { nested: { a: 2 } } };

        expect(checker(next, prev)).toBe(true);
      });

      it("handles arrays deeply", () => {
        const checker = shouldUpdateByKeys({ compare: "deep" }, "items");
        const prev = { items: [{ id: 1 }, { id: 2 }] };
        const next = { items: [{ id: 1 }, { id: 2 }] };

        expect(checker(next, prev)).toBe(false);

        const nextChanged = { items: [{ id: 1 }, { id: 3 }] };
        expect(checker(nextChanged, prev)).toBe(true);
      });
    });

    describe("multiple keys with options", () => {
      it("checks all keys with specified comparison mode", () => {
        const checker = shouldUpdateByKeys({ compare: "deep" }, "config", "metadata");
        const prev = { config: { a: 1 }, metadata: { b: 2 } };
        const next = { config: { a: 1 }, metadata: { b: 2 } };

        expect(checker(next, prev)).toBe(false);
      });

      it("returns true if any key differs", () => {
        const checker = shouldUpdateByKeys({ compare: "deep" }, "config", "metadata");
        const prev = { config: { a: 1 }, metadata: { b: 2 } };
        const next = { config: { a: 1 }, metadata: { b: 3 } };

        expect(checker(next, prev)).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("handles undefined values", () => {
        const checker = shouldUpdateByKeys("name");
        const prev = { name: undefined };
        const next = { name: undefined };

        expect(checker(next, prev)).toBe(false);
      });

      it("handles null values", () => {
        const checker = shouldUpdateByKeys("name");
        const prev = { name: null };
        const next = { name: null };

        expect(checker(next, prev)).toBe(false);
      });

      it("detects change from undefined to value", () => {
        const checker = shouldUpdateByKeys("name");
        const prev = { name: undefined };
        const next = { name: "test" };

        expect(checker(next, prev)).toBe(true);
      });

      it("handles missing keys", () => {
        const checker = shouldUpdateByKeys<{ name?: string }>("name");
        const prev = {} as { name?: string };
        const next = {} as { name?: string };

        expect(checker(next, prev)).toBe(false);
      });
    });
  });
});
