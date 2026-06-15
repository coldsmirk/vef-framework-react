import { describe, expect, it } from "vitest";

import { mergeWith } from "./object";

describe("utils/object", () => {
  describe("mergeWith", () => {
    describe("basic functionality", () => {
      it("merges source object into target object without overriding existing values by default", () => {
        const target = {
          a: 1,
          b: 2
        };
        const source = {
          b: 3,
          c: 4
        };
        const result = mergeWith(target, source);

        // Should return the same target object
        expect(result).toBe(target);
        // b is not overridden
        expect(result).toEqual({
          a: 1,
          b: 2,
          c: 4
        });
      });

      it("does not override existing values when overrideExisting is false (default)", () => {
        const target = {
          a: 1,
          b: 2,
          c: undefined as number | undefined
        };
        const source: Partial<typeof target> & { d?: number } = {
          a: 10,
          b: 20,
          c: 30,
          d: 40
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: 1,
          b: 2,
          c: 30,
          d: 40
        });
      });

      it("overrides existing values when overrideExisting is true", () => {
        const target = {
          a: 1,
          b: 2,
          c: undefined as number | undefined
        };
        const source: Partial<typeof target> & { d?: number } = {
          a: 10,
          b: 20,
          c: 30,
          d: 40
        };
        const result = mergeWith(target, source, true);

        expect(result).toEqual({
          a: 10,
          b: 20,
          c: 30,
          d: 40
        });
      });
    });

    describe("undefined value handling", () => {
      it("filters out undefined values from source", () => {
        const target = {
          a: 1,
          b: 2
        };
        const source = {
          a: undefined,
          b: 20,
          c: undefined,
          d: 40
        };
        const result = mergeWith(target, source);

        // b is not overridden because it already has a value
        expect(result).toEqual({
          a: 1,
          b: 2,
          d: 40
        });
      });

      it("does not override target values with undefined from source", () => {
        const target = {
          a: 1,
          b: 2,
          c: 3
        };
        const source = {
          a: undefined,
          b: undefined,
          d: 4
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: 1,
          b: 2,
          c: 3,
          d: 4
        });
      });

      it("sets undefined target values when source has non-undefined values", () => {
        const target = {
          a: undefined as number | undefined,
          b: 2,
          c: undefined as number | undefined
        };
        const source: Partial<typeof target> = {
          a: 10,
          b: 20,
          c: 30
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: 10,
          b: 2,
          c: 30
        });
      });

      it("overrides undefined target values even when overrideExisting is false", () => {
        const target = {
          a: undefined as number | undefined,
          b: 2
        };
        const source: Partial<typeof target> = {
          a: 10,
          b: 20
        };
        const result = mergeWith(target, source, false);

        expect(result).toEqual({
          a: 10,
          b: 2
        });
      });
    });

    describe("edge cases", () => {
      it("handles empty source object", () => {
        const target = {
          a: 1,
          b: 2
        };
        const source = {};
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: 1,
          b: 2
        });
        expect(result).toBe(target);
      });

      it("handles empty target object", () => {
        const target = {};
        const source = {
          a: 1,
          b: 2
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: 1,
          b: 2
        });
        expect(result).toBe(target);
      });

      it("handles both empty objects", () => {
        const target = {};
        const source = {};
        const result = mergeWith(target, source);

        expect(result).toEqual({});
        expect(result).toBe(target);
      });

      it("handles source with only undefined values", () => {
        const target = {
          a: 1,
          b: 2
        };
        const source = {
          a: undefined,
          b: undefined,
          c: undefined
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: 1,
          b: 2
        });
      });

      it("handles target with only undefined values", () => {
        const target = {
          a: undefined as number | undefined,
          b: undefined as number | undefined
        };
        const source: Partial<typeof target> = {
          a: 1,
          b: 2
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: 1,
          b: 2
        });
      });
    });

    describe("different data types", () => {
      it("handles null values", () => {
        const target = {
          a: null as number | null,
          b: 2 as number | null
        };
        const source = {
          a: 1,
          b: null as number | null,
          c: null as number | null
        };
        const result = mergeWith(target, source);

        // existing values are not overridden
        expect(result).toEqual({
          a: null,
          b: 2,
          c: null
        });
      });

      it("handles boolean values", () => {
        const target = {
          a: true,
          b: false
        };
        const source = {
          a: false,
          b: true,
          c: false
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: true,
          b: false,
          c: false
        });
      });

      it("handles string values", () => {
        const target = {
          a: "hello",
          b: ""
        };
        const source = {
          a: "world",
          b: "test",
          c: "new"
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: "hello",
          b: "",
          c: "new"
        });
      });

      it("handles number values including zero", () => {
        const target = {
          a: 0,
          b: 1
        };
        const source = {
          a: 10,
          b: 0,
          c: -1
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: 0,
          b: 1,
          c: -1
        });
      });

      it("handles array values", () => {
        const target = {
          a: [1, 2],
          b: [] as number[]
        };
        const source = {
          a: [3, 4],
          b: [5, 6],
          c: [7, 8]
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          a: [1, 2],
          b: [],
          c: [7, 8]
        });
      });
    });

    describe("overrideExisting parameter behavior", () => {
      it("respects overrideExisting=false for all value types", () => {
        const target = {
          str: "original",
          num: 42,
          bool: true,
          arr: [1, 2],
          obj: {
            a: 1
          },
          nil: null as string | null,
          undef: undefined as string | undefined
        };
        const source: Partial<typeof target> = {
          str: "new",
          num: 100,
          bool: false,
          arr: [3, 4],
          obj: {
            a: 2
          },
          nil: "not null",
          undef: "defined"
        };
        const result = mergeWith(target, source, false);

        expect(result).toEqual({
          str: "original",
          num: 42,
          bool: true,
          arr: [1, 2],
          obj: {
            a: 1
          },
          nil: null,
          // undefined gets overridden
          undef: "defined"
        });
      });

      it("respects overrideExisting=true for all value types", () => {
        const target = {
          str: "original",
          num: 42,
          bool: true,
          arr: [1, 2],
          obj: {
            a: 1
          },
          nil: null as string | null,
          undef: undefined as string | undefined
        };
        const source: Partial<typeof target> = {
          str: "new",
          num: 100,
          bool: false,
          arr: [3, 4],
          obj: {
            a: 2
          },
          nil: "not null",
          undef: "defined"
        };
        const result = mergeWith(target, source, true);

        expect(result).toEqual({
          str: "new",
          num: 100,
          bool: false,
          arr: [3, 4],
          obj: {
            a: 2
          },
          nil: "not null",
          undef: "defined"
        });
      });
    });

    describe("real-world scenarios", () => {
      it("works as a defaults merger", () => {
        const userConfig = {
          theme: "dark",
          language: undefined as string | undefined
        };
        const defaultConfig: Partial<typeof userConfig> & { timeout?: number } = {
          theme: "light",
          language: "en",
          timeout: 5000
        };
        const result = mergeWith(userConfig, defaultConfig);

        expect(result).toEqual({
          theme: "dark",
          language: "en",
          timeout: 5000
        });
      });

      it("works for configuration overrides", () => {
        const baseConfig = {
          host: "localhost",
          port: 3000,
          ssl: false
        };
        const envConfig = {
          host: "production.com",
          ssl: true,
          timeout: 30_000
        };
        const result = mergeWith(baseConfig, envConfig, true);

        expect(result).toEqual({
          host: "production.com",
          port: 3000,
          ssl: true,
          timeout: 30_000
        });
      });
    });

    describe("immutability concerns", () => {
      it("modifies the target object in place", () => {
        const target = {
          a: 1
        };
        const source: Partial<typeof target> & { b?: number } = {
          b: 2
        };
        const result = mergeWith(target, source);

        expect(result).toBe(target);
        expect(target).toEqual({
          a: 1,
          b: 2
        });
      });

      it("does not modify the source object", () => {
        const target = {
          a: 1
        };
        const source: Partial<typeof target> & { b?: number } = {
          b: 2
        };
        const originalSource = {
          ...source
        };

        mergeWith(target, source);

        expect(source).toEqual(originalSource);
      });
    });

    describe("type safety", () => {
      it("maintains type safety with proper typing", () => {
        interface Config {
          host: string;
          port: number;
          ssl?: boolean;
        }

        const target: Config = {
          host: "localhost",
          port: 3000
        };
        const source: Partial<Config> = {
          ssl: true
        };
        const result = mergeWith(target, source);

        expect(result).toEqual({
          host: "localhost",
          port: 3000,
          ssl: true
        });
      });
    });
  });
});
