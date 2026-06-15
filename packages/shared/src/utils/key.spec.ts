import { describe, expect, it } from "vitest";

import { hashKey } from "./key";

describe("shared/utils/key/hashKey", () => {
  describe("primitive inputs", () => {
    it("hashes a string identically twice", () => {
      expect(hashKey("hello")).toBe(hashKey("hello"));
    });

    it("hashes a number identically twice", () => {
      expect(hashKey(42)).toBe(hashKey(42));
    });

    it("produces distinct hashes for different primitives", () => {
      expect(hashKey("1")).not.toBe(hashKey(1));
    });

    it("hashes null and undefined to different JSON literals", () => {
      expect(hashKey(null)).toBe("null");
      // eslint-disable-next-line unicorn/no-useless-undefined
      expect(hashKey(undefined)).toBe(undefined);
    });
  });

  describe("plain objects", () => {
    it("produces the same hash regardless of key order", () => {
      const left = {
        a: 1,
        b: 2,
        c: 3
      };
      const right = {
        c: 3,
        b: 2,
        a: 1
      };

      expect(hashKey(left)).toBe(hashKey(right));
    });

    it("produces distinct hashes when values differ", () => {
      expect(hashKey({ a: 1 })).not.toBe(hashKey({ a: 2 }));
    });

    it("handles nested objects with reordered keys", () => {
      const left = { outer: { a: 1, b: 2 } };
      const right = { outer: { b: 2, a: 1 } };

      expect(hashKey(left)).toBe(hashKey(right));
    });
  });

  describe("arrays", () => {
    it("treats arrays as order-sensitive", () => {
      expect(hashKey([1, 2, 3])).not.toBe(hashKey([3, 2, 1]));
    });

    it("produces the same hash for identical arrays", () => {
      expect(hashKey([1, "a", true])).toBe(hashKey([1, "a", true]));
    });
  });

  describe("symbol keys", () => {
    it("includes symbol keys with the '@@' prefix", () => {
      const sym = Symbol("custom");
      const result = hashKey({ [sym]: "value" });

      expect(result).toContain("@@Symbol(custom)");
      expect(result).toContain("value");
    });
  });
});
