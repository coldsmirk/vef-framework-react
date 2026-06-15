import type { Primitive } from "type-fest";

export type Builtin = Primitive | Function | Date | Error | RegExp;

export type Key = string;
export type Awaitable<T> = T | Promise<T>;
export type MaybeArray<T> = T | T[];
export type MaybeNullish<T> = T | null | undefined;
export type MaybeUndefined<T> = T | undefined;
export type MaybeNull<T> = T | null;
export type IsString<T> = T extends string ? true : false;

/**
 * Inverts a boolean type.
 *
 * @example Not<true> = false, Not<false> = true
 */
export type Not<A extends boolean> = A extends true ? false : A extends false ? true : never;

export interface EmptyObject {}

export type AnyObject = Record<keyof any, any>;

export type RenameKey<T, TOldKey extends keyof T, TNewKey extends string> = {
  [K in keyof T as K extends TOldKey ? TNewKey : K]: T[K];
};

export type NonFunctionGuard<T> = T extends Function ? never : T;

/**
 * Omits all symbol keys from an object type.
 */
export type OmitSymbol<T> = {
  [K in keyof T as K extends symbol ? never : K]: T[K];
};

export type {
  And,
  DistributedOmit,
  DistributedPick,
  Except,
  HasOptionalKeys,
  HasRequiredKeys,
  If,
  IsAny,
  IsBooleanLiteral,
  IsEqual,
  IsFloat,
  IsInteger,
  IsLiteral,
  IsNever,
  IsNull,
  IsNullable,
  IsNumericLiteral,
  IsOptional,
  IsOptionalKeyOf,
  IsReadonlyKeyOf,
  IsRequiredKeyOf,
  IsStringLiteral,
  IsSymbolLiteral,
  IsTuple,
  IsUndefined,
  IsUnknown,
  IsWritableKeyOf,
  IterableElement,
  KebabCase,
  LiteralUnion,
  NonEmptyObject,
  NonEmptyString,
  NonEmptyTuple,
  OptionalKeysOf,
  Or,
  OverrideProperties,
  PartialDeep,
  Primitive,
  RequiredDeep,
  RequiredKeysOf,
  SetFieldType,
  SetOptional,
  SetParameterType,
  SetReadonly,
  SetRequired,
  SetReturnType,
  Simplify,
  SimplifyDeep
} from "type-fest";
