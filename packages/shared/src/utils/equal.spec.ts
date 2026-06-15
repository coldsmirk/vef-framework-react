import { describe, expect, it } from "vitest";

import { isDeepEqual, isShallowEqual } from "..";

describe("utils/equal", () => {
  describe("isShallowEqual", () => {
    describe("primitive values", () => {
      it("returns true for identical primitive values", () => {
        expect(isShallowEqual(1, 1)).toBe(true);
        expect(isShallowEqual("hello", "hello")).toBe(true);
        expect(isShallowEqual(true, true)).toBe(true);
        expect(isShallowEqual(false, false)).toBe(true);
        expect(isShallowEqual(null, null)).toBe(true);
        // @ts-expect-error - we want to test the function with undefined values
        expect(isShallowEqual()).toBe(true);
      });

      it("returns false for different primitive values", () => {
        expect(isShallowEqual(1, 2)).toBe(false);
        expect(isShallowEqual("hello", "world")).toBe(false);
        expect(isShallowEqual(true, false)).toBe(false);
        // @ts-expect-error - we want to test the function with the second argument undefined
        expect(isShallowEqual(null)).toBe(false);
        expect(isShallowEqual(0, false)).toBe(false);
        expect(isShallowEqual("", false)).toBe(false);
      });

      it("handles special number values", () => {
        expect(isShallowEqual(Number.NaN, Number.NaN)).toBe(true);
        expect(isShallowEqual(0, -0)).toBe(false);
        expect(isShallowEqual(Infinity, Infinity)).toBe(true);
        expect(isShallowEqual(-Infinity, -Infinity)).toBe(true);
        expect(isShallowEqual(Infinity, -Infinity)).toBe(false);
      });
    });

    describe("objects", () => {
      it("returns true for same object reference", () => {
        const obj = {
          a: 1,
          b: 2
        };
        expect(isShallowEqual(obj, obj)).toBe(true);
      });

      it("returns true for objects with same shallow properties", () => {
        const obj1 = {
          a: 1,
          b: 2,
          c: "test"
        };
        const obj2 = {
          a: 1,
          b: 2,
          c: "test"
        };
        expect(isShallowEqual(obj1, obj2)).toBe(true);
      });

      it("returns false for objects with different properties", () => {
        const obj1 = {
          a: 1,
          b: 2
        };
        const obj2 = {
          a: 1,
          b: 3
        };
        expect(isShallowEqual(obj1, obj2)).toBe(false);
      });

      it("returns false for objects with different number of properties", () => {
        const obj1 = {
          a: 1,
          b: 2
        };
        const obj2 = {
          a: 1,
          b: 2,
          c: 3
        };
        expect(isShallowEqual(obj1, obj2)).toBe(false);
      });

      it("returns false for objects with different property names", () => {
        const obj1 = {
          a: 1,
          b: 2
        };
        const obj2 = {
          a: 1,
          c: 2
        };
        expect(isShallowEqual(obj1, obj2)).toBe(false);
      });

      it("does not perform deep comparison for nested objects", () => {
        const obj1 = {
          a: { x: 1 },
          b: 2
        };
        const obj2 = {
          a: { x: 1 },
          b: 2
        };
        expect(isShallowEqual(obj1, obj2)).toBe(false);
      });

      it("returns true for nested objects with same reference", () => {
        const nested = { x: 1 };
        const obj1 = {
          a: nested,
          b: 2
        };
        const obj2 = {
          a: nested,
          b: 2
        };
        expect(isShallowEqual(obj1, obj2)).toBe(true);
      });

      it("handles empty objects", () => {
        expect(isShallowEqual({}, {})).toBe(true);
        expect(isShallowEqual({}, { a: 1 })).toBe(false);
      });
    });

    describe("arrays", () => {
      it("returns true for same array reference", () => {
        const arr = [1, 2, 3];
        expect(isShallowEqual(arr, arr)).toBe(true);
      });

      it("returns true for arrays with same shallow elements", () => {
        const arr1 = [1, 2, "test"];
        const arr2 = [1, 2, "test"];
        expect(isShallowEqual(arr1, arr2)).toBe(true);
      });

      it("returns false for arrays with different elements", () => {
        const arr1 = [1, 2, 3];
        const arr2 = [1, 2, 4];
        expect(isShallowEqual(arr1, arr2)).toBe(false);
      });

      it("returns false for arrays with different lengths", () => {
        const arr1 = [1, 2];
        const arr2 = [1, 2, 3];
        expect(isShallowEqual(arr1, arr2)).toBe(false);
      });

      it("does not perform deep comparison for nested arrays", () => {
        const arr1 = [[1, 2], [3, 4]];
        const arr2 = [[1, 2], [3, 4]];
        expect(isShallowEqual(arr1, arr2)).toBe(false);
      });

      it("handles empty arrays", () => {
        expect(isShallowEqual([], [])).toBe(true);
        expect(isShallowEqual([], [1])).toBe(false);
      });
    });

    describe("map objects", () => {
      it("returns true for same Map reference", () => {
        const map = new Map([["a", 1], ["b", 2]]);
        expect(isShallowEqual(map, map)).toBe(true);
      });

      it("returns true for Maps with same entries", () => {
        const map1 = new Map([["a", 1], ["b", 2]]);
        const map2 = new Map([["a", 1], ["b", 2]]);
        expect(isShallowEqual(map1, map2)).toBe(true);
      });

      it("returns true for Maps with same entries in different order", () => {
        const map1 = new Map([["a", 1], ["b", 2]]);
        const map2 = new Map([["b", 2], ["a", 1]]);
        expect(isShallowEqual(map1, map2)).toBe(true);
      });

      it("returns false for Maps with different values", () => {
        const map1 = new Map([["a", 1], ["b", 2]]);
        const map2 = new Map([["a", 1], ["b", 3]]);
        expect(isShallowEqual(map1, map2)).toBe(false);
      });

      it("returns false for Maps with different keys", () => {
        const map1 = new Map([["a", 1], ["b", 2]]);
        const map2 = new Map([["a", 1], ["c", 2]]);
        expect(isShallowEqual(map1, map2)).toBe(false);
      });

      it("returns false for Maps with different sizes", () => {
        const map1 = new Map([["a", 1]]);
        const map2 = new Map([["a", 1], ["b", 2]]);
        expect(isShallowEqual(map1, map2)).toBe(false);
      });

      it("handles empty Maps", () => {
        const map1 = new Map();
        const map2 = new Map();
        expect(isShallowEqual(map1, map2)).toBe(true);
      });

      it("handles Maps with complex keys", () => {
        const key = { id: 1 };
        const map1 = new Map([[key, "value"]]);
        const map2 = new Map([[key, "value"]]);
        expect(isShallowEqual(map1, map2)).toBe(true);
      });
    });

    describe("set objects", () => {
      it("returns true for same Set reference", () => {
        const set = new Set([1, 2, 3]);
        expect(isShallowEqual(set, set)).toBe(true);
      });

      it("returns true for Sets with same values", () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([1, 2, 3]);
        expect(isShallowEqual(set1, set2)).toBe(true);
      });

      it("returns true for Sets with same values in different order", () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([3, 1, 2]);
        expect(isShallowEqual(set1, set2)).toBe(true);
      });

      it("returns false for Sets with different values", () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([1, 2, 4]);
        expect(isShallowEqual(set1, set2)).toBe(false);
      });

      it("returns false for Sets with different sizes", () => {
        const set1 = new Set([1, 2]);
        const set2 = new Set([1, 2, 3]);
        expect(isShallowEqual(set1, set2)).toBe(false);
      });

      it("handles empty Sets", () => {
        const set1 = new Set();
        const set2 = new Set();
        expect(isShallowEqual(set1, set2)).toBe(true);
      });

      it("handles Sets with complex values", () => {
        const obj = { id: 1 };
        const set1 = new Set([obj, "test"]);
        const set2 = new Set([obj, "test"]);
        expect(isShallowEqual(set1, set2)).toBe(true);
      });
    });

    describe("mixed types", () => {
      it("returns false for different types", () => {
        expect(isShallowEqual({}, [])).toBe(false);
        expect(isShallowEqual([], new Map())).toBe(false);
        expect(isShallowEqual(new Set(), {})).toBe(false);
        expect(isShallowEqual("123", 123)).toBe(false);
        expect(isShallowEqual(null, {})).toBe(false);
        expect(isShallowEqual(undefined, null)).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("handles objects with null prototype", () => {
        const obj1 = Object.create(null);
        obj1.a = 1;
        const obj2 = Object.create(null);
        obj2.a = 1;
        expect(isShallowEqual(obj1, obj2)).toBe(true);
      });

      it("handles objects with symbol properties", () => {
        const sym = Symbol("test");
        const obj1 = {
          [sym]: "value",
          normal: 1
        };
        const obj2 = {
          [sym]: "value",
          normal: 1
        };

        // Symbol properties are not enumerable by default, so they won't be compared
        expect(isShallowEqual(obj1, obj2)).toBe(true);
      });
    });
  });

  describe("isDeepEqual", () => {
    describe("primitive values", () => {
      it("returns true for identical primitive values", () => {
        expect(isDeepEqual(1, 1)).toBe(true);
        expect(isDeepEqual("test", "test")).toBe(true);
        expect(isDeepEqual(true, true)).toBe(true);
        expect(isDeepEqual(null, null)).toBe(true);
        // @ts-expect-error - we want to test the function with undefined values
        expect(isDeepEqual()).toBe(true);
      });

      it("returns false for different primitive values", () => {
        expect(isDeepEqual(1, 2)).toBe(false);
        expect(isDeepEqual("test", "different")).toBe(false);
        expect(isDeepEqual(true, false)).toBe(false);
        // @ts-expect-error - we want to test the function with the second argument undefined
        expect(isDeepEqual(null)).toBe(false);
      });
    });

    describe("objects", () => {
      it("returns true for deeply equal objects", () => {
        const obj1 = {
          a: 1,
          b: {
            c: 2,
            d: {
              e: 3
            }
          }
        };
        const obj2 = {
          a: 1,
          b: {
            c: 2,
            d: {
              e: 3
            }
          }
        };
        expect(isDeepEqual(obj1, obj2)).toBe(true);
      });

      it("returns false for deeply different objects", () => {
        const obj1 = {
          a: 1,
          b: {
            c: 2,
            d: {
              e: 3
            }
          }
        };
        const obj2 = {
          a: 1,
          b: {
            c: 2,
            d: {
              // Different value
              e: 4
            }
          }
        };
        expect(isDeepEqual(obj1, obj2)).toBe(false);
      });

      it("handles circular references", () => {
        const obj1: any = { value: 1 };
        obj1.self = obj1;

        const obj2: any = { value: 1 };
        obj2.self = obj2;

        const obj3: any = { value: 2 };
        obj3.self = obj3;

        expect(isDeepEqual(obj1, obj2)).toBe(true);
        expect(isDeepEqual(obj1, obj3)).toBe(false);
      });

      it("handles complex circular references", () => {
        const obj1: any = {
          a: 1,
          nested: {
            value: 2
          }
        };
        obj1.nested.parent = obj1;

        const obj2: any = {
          a: 1,
          nested: {
            value: 2
          }
        };
        obj2.nested.parent = obj2;

        const obj3: any = {
          a: 1,
          nested: {
            // Different value
            value: 3
          }
        };
        obj3.nested.parent = obj3;

        expect(isDeepEqual(obj1, obj2)).toBe(true);
        expect(isDeepEqual(obj1, obj3)).toBe(false);
      });
    });

    describe("arrays", () => {
      it("returns true for deeply equal arrays", () => {
        const arr1 = [1, [2, [3, 4]]];
        const arr2 = [1, [2, [3, 4]]];
        expect(isDeepEqual(arr1, arr2)).toBe(true);
      });

      it("returns false for deeply different arrays", () => {
        const arr1 = [1, [2, [3, 4]]];
        // Different value
        const arr2 = [1, [2, [3, 5]]];
        expect(isDeepEqual(arr1, arr2)).toBe(false);
      });

      it("handles arrays with circular references", () => {
        const arr1: any = [1, 2];
        arr1.push(arr1);

        const arr2: any = [1, 2];
        arr2.push(arr2);

        const arr3: any = [1, 3];
        arr3.push(arr3);

        expect(isDeepEqual(arr1, arr2)).toBe(true);
        expect(isDeepEqual(arr1, arr3)).toBe(false);
      });
    });

    describe("special objects", () => {
      it("handles Date objects", () => {
        const date1 = new Date("2023-01-01");
        const date2 = new Date("2023-01-01");
        const date3 = new Date("2023-01-02");

        expect(isDeepEqual(date1, date2)).toBe(true);
        expect(isDeepEqual(date1, date3)).toBe(false);
      });

      it("handles RegExp objects", () => {
        const regex1 = /test/g;
        const regex2 = /test/g;
        const regex3 = /different/g;

        expect(isDeepEqual(regex1, regex2)).toBe(true);
        expect(isDeepEqual(regex1, regex3)).toBe(false);
      });

      it("handles Map objects", () => {
        const map1 = new Map([["a", 1], ["b", 2]]);
        const map2 = new Map([["a", 1], ["b", 2]]);
        const map3 = new Map([["a", 1], ["b", 3]]);

        expect(isDeepEqual(map1, map2)).toBe(true);
        expect(isDeepEqual(map1, map3)).toBe(false);
      });

      it("handles Set objects", () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([1, 2, 3]);
        const set3 = new Set([1, 2, 4]);

        expect(isDeepEqual(set1, set2)).toBe(true);
        expect(isDeepEqual(set1, set3)).toBe(false);
      });

      it("handles nested Maps with circular references", () => {
        const map1 = new Map();
        const obj1: any = { value: 1, map: map1 };
        map1.set("obj", obj1);

        const map2 = new Map();
        const obj2: any = { value: 1, map: map2 };
        map2.set("obj", obj2);

        expect(isDeepEqual(map1, map2)).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("handles null and undefined", () => {
        expect(isDeepEqual(null, null)).toBe(true);
        // @ts-expect-error - we want to test the function with undefined values
        expect(isDeepEqual()).toBe(true);
        // @ts-expect-error - we want to test the function with the second argument undefined
        expect(isDeepEqual(null)).toBe(false);
      });

      it("handles mixed types", () => {
        expect(isDeepEqual({}, [])).toBe(false);
        expect(isDeepEqual([], {})).toBe(false);
        expect(isDeepEqual("1", 1)).toBe(false);
      });

      it("handles deeply nested structures with multiple circular references", () => {
        const root1: any = {
          level1: {
            level2: {
              level3: {}
            }
          }
        };
        root1.level1.level2.level3.backToRoot = root1;
        root1.level1.level2.level3.backToLevel1 = root1.level1;

        const root2: any = {
          level1: {
            level2: {
              level3: {}
            }
          }
        };
        root2.level1.level2.level3.backToRoot = root2;
        root2.level1.level2.level3.backToLevel1 = root2.level1;

        expect(isDeepEqual(root1, root2)).toBe(true);
      });

      it("handles NaN values", () => {
        expect(isDeepEqual(Number.NaN, Number.NaN)).toBe(true);
        expect(isDeepEqual(Number.NaN, 0)).toBe(false);
        expect(isDeepEqual(0, Number.NaN)).toBe(false);
      });

      it("handles ArrayBuffer objects", () => {
        const buffer1 = new ArrayBuffer(8);
        const buffer2 = new ArrayBuffer(8);
        const buffer3 = new ArrayBuffer(4);

        // Fill with same data
        const view1 = new DataView(buffer1);
        const view2 = new DataView(buffer2);
        view1.setUint8(0, 255);
        view2.setUint8(0, 255);

        expect(isDeepEqual(buffer1, buffer2)).toBe(true);
        expect(isDeepEqual(buffer1, buffer3)).toBe(false);
      });

      it("handles TypedArray objects", () => {
        const arr1 = new Uint8Array([1, 2, 3, 4]);
        const arr2 = new Uint8Array([1, 2, 3, 4]);
        const arr3 = new Uint8Array([1, 2, 3, 5]);

        expect(isDeepEqual(arr1, arr2)).toBe(true);
        expect(isDeepEqual(arr1, arr3)).toBe(false);
      });

      it("handles DataView objects", () => {
        const buffer1 = new ArrayBuffer(8);
        const buffer2 = new ArrayBuffer(8);
        const view1 = new DataView(buffer1);
        const view2 = new DataView(buffer2);

        view1.setUint8(0, 255);
        view2.setUint8(0, 255);

        expect(isDeepEqual(view1, view2)).toBe(true);

        view2.setUint8(0, 254);
        expect(isDeepEqual(view1, view2)).toBe(false);
      });

      it("handles objects with custom valueOf", () => {
        const obj1 = {
          valueOf() {
            return 42;
          }
        };
        const obj2 = {
          valueOf() {
            return 42;
          }
        };
        const obj3 = {
          valueOf() {
            return 43;
          }
        };

        expect(isDeepEqual(obj1, obj2)).toBe(true);
        expect(isDeepEqual(obj1, obj3)).toBe(false);
      });

      it("handles objects with custom toString", () => {
        const obj1 = {
          toString() {
            return "custom-string";
          }
        };
        const obj2 = {
          toString() {
            return "custom-string";
          }
        };
        const obj3 = {
          toString() {
            return "different-string";
          }
        };

        expect(isDeepEqual(obj1, obj2)).toBe(true);
        expect(isDeepEqual(obj1, obj3)).toBe(false);
      });

      it("handles RegExp with flags correctly", () => {
        const regex1 = /test/gi;
        const regex2 = /test/gi;
        // Missing 'i' flag
        const regex3 = /test/g;
        const regex4 = /different/gi;

        expect(isDeepEqual(regex1, regex2)).toBe(true);
        expect(isDeepEqual(regex1, regex3)).toBe(false);
        expect(isDeepEqual(regex1, regex4)).toBe(false);
      });

      it("handles prototype differences", () => {
        class ClassA {
          value = 1;
        }

        class ClassB {
          value = 1;
        }

        const objA = new ClassA();
        const objB = new ClassB();
        const plainObj = { value: 1 };

        expect(isDeepEqual(objA, objB)).toBe(false);
        expect(isDeepEqual(objA, plainObj)).toBe(false);
      });
    });
  });
});
