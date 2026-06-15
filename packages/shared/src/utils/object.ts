import { isUndefined } from "./lib";

/**
 * Merges the source object into the target object
 *
 * @param target - The target object
 * @param source - The source object
 * @param overrideExisting - Whether to override existing values
 * @returns The merged object with the source object merged into the target object
 */
export function mergeWith<T extends object>(target: T, source: Partial<T>, overrideExisting = false): T {
  for (const [key, value] of Object.entries(source)) {
    if (isUndefined(value)) {
      continue;
    }

    const targetKey = key as keyof T;

    if (overrideExisting || isUndefined(target[targetKey])) {
      target[targetKey] = value as T[keyof T];
    }
  }

  return target;
}
