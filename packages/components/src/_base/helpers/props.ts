import { isUndefined } from "@vef-framework-react/shared";

export type FilteredProps<T extends Record<string, unknown>> = {
  [K in keyof T]-?: T[K] extends undefined ? never : T[K];
};

export function filterProps<T extends Record<string, unknown>>(props: T): FilteredProps<T> {
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => !isUndefined(value))
  ) as FilteredProps<T>;
}

export function mergeProps<
  TProps extends Record<string, unknown>,
  TDefault extends TProps
>(props: TProps, defaultProps: TDefault): TDefault & FilteredProps<TProps> {
  return {
    ...defaultProps,
    ...filterProps(props)
  };
}
