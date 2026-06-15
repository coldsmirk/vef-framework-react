/**
 * Shallowly compares two values.
 *
 * @param value1 - The first value to compare.
 * @param value2 - The second value to compare.
 * @returns `true` if the values are shallowly equal, `false` otherwise.
 */
export function isShallowEqual(value1: unknown, value2: unknown): boolean {
  if (Object.is(value1, value2)) {
    return true;
  }

  if (
    typeof value1 !== "object"
    || value1 === null
    || typeof value2 !== "object"
    || value2 === null
  ) {
    return false;
  }

  if (value1 instanceof Map && value2 instanceof Map) {
    if (value1.size !== value2.size) {
      return false;
    }

    for (const [k, v] of value1) {
      if (!value2.has(k) || !Object.is(v, value2.get(k))) {
        return false;
      }
    }

    return true;
  }

  if (value1 instanceof Set && value2 instanceof Set) {
    if (value1.size !== value2.size) {
      return false;
    }

    for (const v of value1) {
      if (!value2.has(v)) {
        return false;
      }
    }

    return true;
  }

  // Check if both values are the same object type
  const isArray1 = Array.isArray(value1);
  const isArray2 = Array.isArray(value2);

  if (isArray1 !== isArray2) {
    return false;
  }

  // Check if either value is a Map, Set, or other special object type
  // If they're different constructor types, they're not equal
  if (value1.constructor !== value2.constructor) {
    return false;
  }

  const keysA = Object.keys(value1);
  const keysB = Object.keys(value2);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const element of keysA) {
    if (
      !Object.hasOwn(value2, element as string)
      || !Object.is(value1[element as keyof object], value2[element as keyof object])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Deeply compares two values, with support for circular references.
 *
 * @param value1 - The first value to compare.
 * @param value2 - The second value to compare.
 * @returns `true` if the values are deeply equal, `false` otherwise.
 */
export function isDeepEqual(value1: unknown, value2: unknown): boolean {
  const { valueOf, toString } = Object.prototype;

  // Track visited objects to handle circular references
  // For each invocation we create a new function to maintain clean state
  const visited = new WeakMap<object, object>();

  const compareValues = (currentFirst: unknown, currentSecond: unknown): boolean => {
    // Strict equality check (handles primitives and same reference)
    if (currentFirst === currentSecond) {
      return true;
    }

    // Handle non-object values including null
    if (
      typeof currentFirst !== "object"
      || typeof currentSecond !== "object"
      || !currentFirst
      || !currentSecond
    ) {
      // Efficient NaN comparison - NaN is the only value that's not equal to itself
      // eslint-disable-next-line no-self-compare
      return currentFirst !== currentFirst && currentSecond !== currentSecond;
    }

    // Check if prototypes are different - more precise than constructor comparison
    if (Object.getPrototypeOf(currentFirst) !== Object.getPrototypeOf(currentSecond)) {
      return false;
    }

    const { constructor } = currentFirst as Record<string, unknown>;

    // Handle Date objects
    if (constructor === Date) {
      return (currentFirst as Date).getTime() === (currentSecond as Date).getTime();
    }

    // Handle RegExp objects with source and flags comparison
    if (constructor === RegExp) {
      const firstRegex = currentFirst as RegExp;
      const secondRegex = currentSecond as RegExp;
      return firstRegex.source === secondRegex.source && firstRegex.flags === secondRegex.flags;
    }

    // Handle Set objects (requires deep comparison for values)
    if (constructor === Set) {
      const firstSet = currentFirst as Set<unknown>;
      const secondSet = currentSecond as Set<unknown>;

      if (firstSet.size !== secondSet.size) {
        return false;
      }

      for (const value of firstSet) {
        let found = false;

        for (const secondValue of secondSet) {
          if (compareValues(value, secondValue)) {
            found = true;
            break;
          }
        }

        if (!found) {
          return false;
        }
      }

      return true;
    }

    // Handle ArrayBuffer objects
    if (constructor === ArrayBuffer) {
      const firstView = new DataView(currentFirst as ArrayBuffer);
      const secondView = new DataView(currentSecond as ArrayBuffer);
      return compareValues(firstView, secondView);
    }

    // Handle DataView and TypedArray objects
    if (constructor === DataView || ArrayBuffer.isView(currentFirst)) {
      let firstView: DataView;
      let secondView: DataView;

      // Handle DataView directly
      if (constructor === DataView) {
        firstView = currentFirst as DataView;
        secondView = currentSecond as DataView;
      } else {
        // Convert TypedArray to DataView for byte-level comparison
        const firstTyped = currentFirst as ArrayBufferView;
        const secondTyped = currentSecond as ArrayBufferView;
        firstView = new DataView(firstTyped.buffer, firstTyped.byteOffset, firstTyped.byteLength);
        secondView = new DataView(secondTyped.buffer, secondTyped.byteOffset, secondTyped.byteLength);
      }

      if (firstView.byteLength !== secondView.byteLength) {
        return false;
      }

      for (let index = firstView.byteLength; index-- !== 0;) {
        if (firstView.getUint8(index) !== secondView.getUint8(index)) {
          return false;
        }
      }

      return true;
    }

    // Check for circular references before processing complex objects
    if (visited.has(currentFirst) && visited.get(currentFirst) === currentSecond) {
      return true;
    }

    visited.set(currentFirst, currentSecond);

    // Handle Array objects
    if (constructor === Array) {
      const firstArray = currentFirst as unknown[];
      const secondArray = currentSecond as unknown[];

      if (firstArray.length !== secondArray.length) {
        return false;
      }

      for (let index = firstArray.length; index-- !== 0;) {
        if (!compareValues(firstArray[index], secondArray[index])) {
          return false;
        }
      }

      return true;
    }

    // Handle Map objects
    if (constructor === Map) {
      const firstMap = currentFirst as Map<unknown, unknown>;
      const secondMap = currentSecond as Map<unknown, unknown>;

      if (firstMap.size !== secondMap.size) {
        return false;
      }

      for (const [key, value] of firstMap) {
        if (!secondMap.has(key) || !compareValues(value, secondMap.get(key))) {
          return false;
        }
      }

      return true;
    }

    // Handle objects with custom valueOf method
    const firstAsAny = currentFirst as any;
    const secondAsAny = currentSecond as any;

    if (
      firstAsAny.valueOf !== valueOf
      && typeof firstAsAny.valueOf === "function"
      && typeof secondAsAny.valueOf === "function"
    ) {
      return firstAsAny.valueOf() === secondAsAny.valueOf();
    }

    // Handle objects with custom toString method
    if (
      firstAsAny.toString !== toString
      && typeof firstAsAny.toString === "function"
      && typeof secondAsAny.toString === "function"
    ) {
      return firstAsAny.toString() === secondAsAny.toString();
    }

    // Handle plain objects - compare all enumerable properties
    const firstKeys = Object.keys(currentFirst);
    const secondKeys = Object.keys(currentSecond);

    if (firstKeys.length !== secondKeys.length) {
      return false;
    }

    for (let index = firstKeys.length; index-- !== 0;) {
      const currentKey = firstKeys[index]!;

      if (
        !Object.hasOwn(currentSecond, currentKey)
        || !compareValues(firstAsAny[currentKey], secondAsAny[currentKey])
      ) {
        return false;
      }
    }

    return true;
  };

  return compareValues(value1, value2);
}
