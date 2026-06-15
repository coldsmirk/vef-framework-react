/**
 * Generates a range of numbers from 0 to N-1 as a tuple type.
 * Used to create a union of valid array indices.
 */
type ComputeRange<N extends number, Result extends unknown[] = []> = Result["length"] extends N
  ? Result
  : ComputeRange<N, [...Result, Result["length"]]>;

/**
 * Union type of numbers from 0 to 39.
 * Limits tuple index depth to prevent excessive type recursion.
 */
type Index40 = ComputeRange<40>[number];

/**
 * Checks if a type is a tuple (fixed-length array) with length <= 40.
 * Returns the tuple type if valid, never otherwise.
 */
type IsTuple<T> = T extends readonly any[] & { length: infer Length }
  ? Length extends Index40
    ? T
    : never
  : never;

/**
 * Extracts all valid numeric indices from a tuple type.
 * For [string, number, boolean], returns 0 | 1 | 2.
 */
type AllowedIndexes<Tuple extends readonly any[], Keys extends number = never> = Tuple extends readonly []
  ? Keys
  : Tuple extends readonly [infer _, ...infer Tail]
    ? AllowedIndexes<Tail, Keys | Tail["length"]>
    : Keys;

/**
 * Creates dot-notation paths for nested properties.
 * Converts TPrefix.NestedKey into string literal types.
 */
type DeepKeysPrefix<T, TPrefix, TDepth extends any[]> = TPrefix extends keyof T & (number | string)
  ? `${TPrefix}.${DeepKeys<T[TPrefix], [...TDepth, any]> & string}`
  : never;

/**
 * Extracts all possible deep property paths from an object type as dot-notation strings.
 * Supports nested objects, tuples, and arrays up to 5 levels deep.
 *
 * @example
 * type User = { name: string; address: { city: string; zip: number } };
 * type Paths = DeepKeys<User>; // "name" | "address" | "address.city" | "address.zip"
 */
export type DeepKeys<T, TDepth extends any[] = []> = TDepth["length"] extends 5
  ? never
  : unknown extends T
    ? string
    : T extends readonly any[] & IsTuple<T>
      ? AllowedIndexes<T> | DeepKeysPrefix<T, AllowedIndexes<T>, TDepth>
      : T extends any[]
        ? DeepKeys<T[number], [...TDepth, any]>
        : T extends Date
          ? never
          : T extends object
            ? (keyof T & string) | DeepKeysPrefix<T, keyof T, TDepth>
            : never;
