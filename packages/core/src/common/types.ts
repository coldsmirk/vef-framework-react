import type { AnyObject, EmptyObject, Except, Key } from "@vef-framework-react/shared";

/**
 * Pagination parameters for list queries.
 * Used to specify which page and how many items per page to retrieve.
 */
export interface PaginationParams {
  /**
   * The page number, starting from 1
   *
   * @default 1
   */
  page?: number;
  /**
   * The number of items per page
   *
   * @default 15
   */
  size?: number;
}

/**
 * Pagination result wrapper for paginated list responses.
 * Contains the items for the current page and the total count across all pages.
 *
 * @template T - The type of items in the paginated list
 */
export interface PaginationResult<T = unknown> {
  /**
   * Total number of items across all pages
   */
  readonly total: number;
  /**
   * Items in the current page
   */
  readonly items: T[];
}

/**
 * Base data option type for select, tree-select, cascader and other data-driven components.
 *
 * @template T - Additional custom fields that can be merged into the option
 * @template M - Type of the metadata field
 */
export type DataOption<T = EmptyObject, M extends AnyObject = AnyObject> = T & {
  /**
   * Display text of the option
   */
  label: string;
  /**
   * Unique identifier of the option
   */
  value: Key;
  /**
   * Whether the option is disabled
   *
   * @default false
   */
  disabled?: boolean;
  /**
   * Additional description or help text for the option
   */
  description?: string;
  /**
   * Additional metadata for the option
   */
  meta?: M;
  /**
   * Child options for tree-like structures (e.g., TreeSelect, Cascader)
   */
  children?: Array<DataOption<T, M>>;
};

/**
 * Data option with pinyin fields for Chinese character search and sorting.
 * Extends {@link DataOption} with pinyin support to enable fuzzy search by pronunciation.
 *
 * @template T - Additional custom fields that can be merged into the option
 * @template M - Type of the metadata field
 */
export type DataOptionWithPinyin<T = EmptyObject, M extends AnyObject = AnyObject> = Except<DataOption<T, M>, "children"> & {
  /**
   * Pinyin representation of the label
   */
  labelPinyin: string;
  /**
   * Initials of the pinyin representation of the label
   */
  labelPinyinInitials: string;
  /**
   * Pinyin representation of the description
   */
  descriptionPinyin?: string;
  /**
   * Initials of the pinyin representation of the description
   */
  descriptionPinyinInitials?: string;
  /**
   * Child options with pinyin support
   */
  children?: Array<DataOptionWithPinyin<T, M>>;
};
