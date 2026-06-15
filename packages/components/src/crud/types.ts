import type { ApiResult, MutationFunction } from "@vef-framework-react/core";
import type { AnyObject, EmptyObject, If, IsNever } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { DrawerProps } from "../drawer";
import type { FormApi } from "../form";
import type { ParamsWithPagination, ParamsWithSort } from "../pro-table";

export type CrudBasicFormScene = "create" | "update";

export interface CrudBasicSceneFormValues<
  TCreateFormValues extends AnyObject,
  TUpdateFormValues extends AnyObject
> {
  create: TCreateFormValues;
  update: TUpdateFormValues;
}
export type CrudFormScene<TSceneFormValues extends AnyObject> = keyof TSceneFormValues & string;
export type CrudFormMutationFns<TSceneFormValues extends AnyObject> = {
  [Scene in CrudFormScene<TSceneFormValues>]: MutationFunction<ApiResult<unknown>, TSceneFormValues[Scene]>;
};

interface CrudFormActionDefaults {
  submitButton: ReactNode;
  resetButton: ReactNode;
}

export type CrudFormActionsRenderers<TSceneFormValues extends AnyObject> = {
  [Scene in CrudFormScene<TSceneFormValues>]?: (
    formApi: FormApi<TSceneFormValues[Scene]>,
    defaults: CrudFormActionDefaults
  ) => ReactNode;
};

/**
 * Query parameters wrapper type for non-paginated queries.
 *
 * This type helps TypeScript correctly infer generic parameters by wrapping
 * the intersection type in a named generic type constructor.
 *
 * @template TSearch - The search parameters type from user interactions
 * @template TParams - Additional query parameters (defaults to never, which becomes EmptyObject)
 */
export type QueryParams<
  TSearch extends AnyObject,
  TParams extends AnyObject = never
> = ParamsWithSort<TSearch & If<IsNever<TParams>, EmptyObject, TParams>>;

/**
 * Query parameters wrapper type for paginated queries.
 *
 * This type helps TypeScript correctly infer generic parameters by wrapping
 * the intersection type in a named generic type constructor.
 *
 * @template TSearch - The search parameters type from user interactions
 * @template TParams - Additional query parameters (defaults to never, which becomes EmptyObject)
 */
export type PaginatedQueryParams<
  TSearch extends AnyObject,
  TParams extends AnyObject = never
> = ParamsWithPagination<ParamsWithSort<TSearch & If<IsNever<TParams>, EmptyObject, TParams>>>;

/**
 * Form display mode for CRUD operations.
 * - "modal": Display form in a modal dialog (default)
 * - "drawer": Display form in a drawer panel
 */
export type CrudFormMode = "modal" | "drawer";

/**
 * Configuration for drawer-specific properties when form mode is "drawer".
 */
export interface CrudFormDrawerConfig {
  /**
   * Placement of the drawer.
   *
   * @default "right"
   */
  placement?: DrawerProps["placement"];
}
