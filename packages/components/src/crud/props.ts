import type { ApiResult, MutationFunction, MutationMeta, PaginationResult, QueryFunction } from "@vef-framework-react/core";
import type { AnyObject, Awaitable, DeepKeys, EmptyObject, If, IsNever, Key, MaybeUndefined, PartialDeep } from "@vef-framework-react/shared";
import type { ElementType, MouseEvent, ReactNode } from "react";

import type { FormLayout } from "../form";
import type { ColumnSettingsProp, OperationColumnConfig, ProTableProps, RowSelectionConfig } from "../pro-table";
import type { TableColumn } from "../table";
import type { CrudFormActionsRenderers, CrudFormMutationFns, CrudFormScene, PaginatedQueryParams, QueryParams } from "./types";

/**
 * Base props for the Crud component.
 *
 * @template TRow - Table row model type
 * @template TSearchValues - Search/filters form values type
 * @template TSceneFormValues - A map of scene key to its form values type
 * @template TParams - Additional query parameters type
 */
export interface BaseCrudProps<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TParams extends AnyObject
> {
  /**
   * Storage key for persisting search state to sessionStorage.
   * If provided, search values will be preserved across route navigations.
   * Each Crud instance should use a unique key.
   */
  storageKey?: string;
  /**
   * Table size
   */
  tableSize?: ProTableProps<TRow, TParams>["size"];
  /**
   * Table column definitions
   */
  tableColumns: Array<TableColumn<NoInfer<TRow>>>;
  /**
   * Column settings configuration.
   * - `false`: Disable column settings feature
   * - `{ storageKey?: string }`: Enable with optional localStorage persistence
   *
   * @default {}
   */
  columnSettings?: ColumnSettingsProp;
  /**
   * Operation column configuration for per-row actions
   */
  operationColumn?: OperationColumnConfig<NoInfer<TRow>>;
  /**
   * Whether to show the sequence (row number) column. Default is true.
   */
  showSequenceColumn?: boolean;
  /**
   * Row key extractor: either a deep key of the row model or a function
   */
  rowKey?: DeepKeys<NoInfer<TRow>> | ((row: NoInfer<TRow>) => Key);
  /**
   * Enable virtual scrolling for the table to improve performance with large datasets
   *
   * @default false
   */
  virtual?: boolean;
  /**
   * Render zebra-striped table rows
   *
   * @default false
   */
  striped?: boolean;
  /**
   * Callback fired when a table body row is clicked.
   *
   * Clicks inside the operation column are ignored so per-row action buttons
   * do not also trigger the row-level action.
   */
  onRowClick?: (row: NoInfer<TRow>, index: number | undefined, event: MouseEvent<HTMLElement>) => void;
  /**
   * Title to be displayed above the table
   */
  title?: ReactNode;
  /**
   * Summary to be displayed below the table
   */
  summary?: ReactNode;
  /**
   * Row selection configuration.
   * - `true`: Enable row selection with default configuration
   * - `RowSelectionConfig<TRow>`: Enable row selection with custom configuration
   * - `undefined`: Disable row selection (default)
   */
  rowSelection?: RowSelectionConfig<NoInfer<TRow>> | true;
  /**
   * Default search values for initializing the search forms
   */
  defaultSearchValues?: Partial<NoInfer<TSearchValues>>;
  /**
   * Node to render as the basic (inline) search area
   */
  basicSearch?: ReactNode;
  /**
   * Node to render as the advanced search panel
   */
  advancedSearch?: ReactNode;
  /**
   * Default form values map for scenes
   */
  sceneDefaultFormValues?: PartialDeep<NoInfer<TSceneFormValues>>;
  /**
   * The element type for the inner form wrapper of the scene form drawer/modal.
   *
   * @default "div"
   */
  formComponent?: ElementType;
  /**
   * Layout of the form items inside the scene form modal/drawer (label
   * position, alignment and width). Defaults to the horizontal layout.
   */
  formLayout?: FormLayout;
  /**
   * Render function to provide a form for the specified scene
   */
  renderForm?: (scene: CrudFormScene<NoInfer<TSceneFormValues>>) => ReactNode;
  /**
   * Optional hook before submitting the form. Can transform values.
   */
  beforeFormSubmit?: (scene: CrudFormScene<NoInfer<TSceneFormValues>>, formValues: TSceneFormValues[CrudFormScene<NoInfer<TSceneFormValues>>]) => Awaitable<TSceneFormValues[CrudFormScene<NoInfer<TSceneFormValues>>]>;
  /**
   * Optional hook after submitting the form. Can be used for side effects.
   */
  afterFormSubmit?: (scene: CrudFormScene<NoInfer<TSceneFormValues>>, formValues: TSceneFormValues[CrudFormScene<NoInfer<TSceneFormValues>>], result: unknown) => Awaitable<void>;
  /**
   * Mutation functions for submitting different scenes
   */
  formMutationFns?: CrudFormMutationFns<TSceneFormValues>;
  /**
   * Custom render functions for form actions in different scenes
   * Allows customization of footer action buttons for each form scene
   */
  formActionsRenderers?: CrudFormActionsRenderers<NoInfer<TSceneFormValues>>;
  /**
   * Mutation function to delete a single row
   */
  deleteMutationFn?: MutationFunction<ApiResult<unknown>, NoInfer<TRow>>;
  /**
   * Mutation function to delete multiple rows
   */
  deleteManyMutationFn?: MutationFunction<ApiResult<unknown>, Array<NoInfer<TRow>>>;
  /**
   * Meta information provider for mutations
   */
  mutationMeta?: (mutationKey: string) => MaybeUndefined<MutationMeta>;
  /**
   * Actions displayed on the table toolbar area
   */
  toolbarActions?: ReactNode;
  /**
   * Function to determine whether the query should be enabled
   */
  queryEnabled?: (params?: NoInfer<TSearchValues> & If<IsNever<TParams>, EmptyObject, NoInfer<TParams>>) => boolean;
  /**
   * Additional query parameters that trigger re-fetching when changed.
   * These are merged with search, pagination, and sort parameters in the query function.
   */
  queryParams?: NoInfer<TParams>;
}

/**
 * Props for paginated Crud.
 *
 * When `isPaginated` is true or omitted, the data source is fetched with pagination parameters.
 *
 * @template TRow - Table row model type
 * @template TSearchValues - Search/filters form values type
 * @template TSceneFormValues - A map of scene key to its form values type
 * @template TParams - Additional query parameters type
 */
export interface PaginatedCrudProps<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TParams extends AnyObject = never
> extends BaseCrudProps<TRow, TSearchValues, TSceneFormValues, TParams> {
  /**
   * Enable pagination mode. Default is true.
   */
  isPaginated?: true;
  /**
   * Query function for fetching paginated data
   */
  queryFn: QueryFunction<PaginationResult<TRow>, PaginatedQueryParams<TSearchValues, TParams>>;
}

/**
 * Props for non-paginated Crud.
 *
 * When `isPaginated` is false, the entire dataset is returned without pagination.
 *
 * @template TRow - Table row model type
 * @template TSearchValues - Search/filters form values type
 * @template TSceneFormValues - A map of scene key to its form values type
 * @template TParams - Additional query parameters type
 */
export interface NonPaginatedCrudProps<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TParams extends AnyObject = never
> extends BaseCrudProps<TRow, TSearchValues, TSceneFormValues, TParams> {
  /**
   * Disable pagination mode for this variant
   */
  isPaginated: false;
  /**
   * Query function for fetching the full list data
   */
  queryFn: QueryFunction<TRow[], QueryParams<TSearchValues, TParams>>;
}

/**
 * Discriminated union of paginated and non-paginated Crud props
 */
export type CrudProps<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TParams extends AnyObject = never
> = PaginatedCrudProps<TRow, TSearchValues, TSceneFormValues, TParams>
  | NonPaginatedCrudProps<TRow, TSearchValues, TSceneFormValues, TParams>;
