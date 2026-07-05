import type { AnyObject, If, IsOptionalKeyOf, IsRequiredKeyOf, IsString, Simplify } from "../types";

import ModernChineseDict from "@pinyin-pro/data/modern";
import { addDict, pinyin } from "pinyin-pro";

import { isString } from "./lib";

export type WithPinyin<
  T extends AnyObject,
  K extends keyof T & string
> = Simplify<
  WithPinyinInternal<T, K>
>;

type WithPinyinInternal<
  T extends AnyObject,
  K extends keyof T & string
> = T & {
  [Key in K as If<IsRequiredKeyOf<T, Key>, If<IsString<T[Key]>, `${Key}Pinyin`, never>, never>]: string;
} & {
  [Key in K as If<IsRequiredKeyOf<T, Key>, If<IsString<T[Key]>, `${Key}PinyinInitials`, never>, never>]: string;
} & {
  [Key in K as If<IsOptionalKeyOf<T, Key>, If<IsString<T[Key]>, `${Key}Pinyin`, never>, never>]?: string;
} & {
  [Key in K as If<IsOptionalKeyOf<T, Key>, If<IsString<T[Key]>, `${Key}PinyinInitials`, never>, never>]?: string;
};

type ExtractSecondOverload<T> = T extends {
  (word: string, options?: any): string;
  (word: string, options?: infer V): string[];
  (word: string, options?: any): any[];
} ? V : never;

type Options = ExtractSecondOverload<typeof pinyin>;

let pinyinDictConfigured = false;

function ensurePinyinDictConfigured(): void {
  if (pinyinDictConfigured) {
    return;
  }

  addDict(ModernChineseDict);
  pinyinDictConfigured = true;
}

const baseOptions: Options = {
  type: "array",
  toneType: "none",
  multiple: false,
  nonZh: "consecutive",
  surname: "head"
};

/**
 * Cache for pinyin conversions to avoid repeated calculations
 */
const pinyinCache = new Map<string, string[]>();
const pinyinInitialsCache = new Map<string, string[]>();

/**
 * Get the pinyin representation of Chinese text
 *
 * @param text - The Chinese text to convert
 * @returns Array of pinyin strings for each character
 */
export function getPinyin(text: string): string[] {
  const cached = pinyinCache.get(text);

  if (cached) {
    return cached;
  }

  ensurePinyinDictConfigured();

  const result = pinyin(
    text,
    {
      ...baseOptions,
      pattern: "pinyin"
    }
  );

  pinyinCache.set(text, result);
  return result;
}

/**
 * Get the initial letters (first letters) of pinyin for Chinese text
 *
 * @param text - The Chinese text to convert
 * @returns Array of initial letters for each character
 */
export function getPinyinInitials(text: string): string[] {
  const cached = pinyinInitialsCache.get(text);

  if (cached) {
    return cached;
  }

  ensurePinyinDictConfigured();

  const result = pinyin(
    text,
    {
      ...baseOptions,
      pattern: "first"
    }
  );

  pinyinInitialsCache.set(text, result);
  return result;
}

/**
 * Add pinyin fields to an object for specified string keys
 *
 * @param obj - The source object
 * @param keys - The keys to add pinyin fields for
 * @returns A new object with additional pinyin and pinyin initials fields
 * @example
 * ```ts
 * const user = { name: "张三", age: 25 };
 * const result = withPinyin(user, "name");
 * // result: { name: "张三", age: 25, namePinyin: "zhangsan", namePinyinInitials: "zs" }
 * ```
 */
export function withPinyin<
  T extends AnyObject,
  K extends keyof T & string
>(
  obj: T,
  ...keys: K[]
): WithPinyin<T, K> {
  const result: WithPinyin<T, K> = { ...obj };

  for (const key of keys) {
    const value = obj[key];

    if (isString(value)) {
      const pinyinKey = `${key}Pinyin` as const;
      const initialsKey = `${key}PinyinInitials` as const;

      result[pinyinKey] = getPinyin(value).join("") as WithPinyin<T, K>[typeof pinyinKey];
      result[initialsKey] = getPinyinInitials(value).join("") as WithPinyin<T, K>[typeof initialsKey];
    }
  }

  return result;
}
