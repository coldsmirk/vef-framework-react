import type { AnyObject } from "../types";

import { isDeepEqual, isShallowEqual } from "./equal";
import { isPlainObject } from "./lib";

/**
 * Comparison mode for reference values
 */
export type CompareMode = "reference" | "shallow" | "deep";

/**
 * Options for shouldUpdateByKeys
 */
export interface ShouldUpdateByKeysOptions {
  /**
   * Comparison mode for reference values
   * - "reference": Use strict equality (===)
   * - "shallow": Use shallow comparison
   * - "deep": Use deep comparison
   *
   * @default "reference"
   */
  compare?: CompareMode;
}

const compareFns: Record<CompareMode, (a: unknown, b: unknown) => boolean> = {
  reference: (a, b) => a === b,
  shallow: isShallowEqual,
  deep: isDeepEqual
};

/**
 * Creates a function that checks if any specified keys differ between two objects.
 * Useful for Table's shouldCellUpdate prop to optimize re-renders.
 */
export function shouldUpdateByKeys<T = AnyObject, const K extends keyof T = keyof T>(
  options: ShouldUpdateByKeysOptions,
  ...keys: K[]
): (next: T, prev: T) => boolean;
export function shouldUpdateByKeys<T = AnyObject, const K extends keyof T = keyof T>(
  ...keys: K[]
): (next: T, prev: T) => boolean;

export function shouldUpdateByKeys<T = AnyObject, const K extends keyof T = keyof T>(
  optionsOrKey: ShouldUpdateByKeysOptions | K,
  ...restKeys: K[]
): (next: T, prev: T) => boolean {
  const isOptions = isPlainObject(optionsOrKey) && "compare" in optionsOrKey;
  const options = isOptions ? (optionsOrKey as ShouldUpdateByKeysOptions) : {};
  const keys = isOptions ? restKeys : [optionsOrKey as K, ...restKeys];
  const compareFn = compareFns[options.compare ?? "reference"];

  return (next: T, prev: T) => keys.some(key => !compareFn(next?.[key], prev?.[key]));
}
