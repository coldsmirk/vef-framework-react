/**
 * Base entity with a unique identifier
 *
 * @template TId - Identifier type, defaults to string
 */
export interface Entity<TId = string> {
  /**
   * Unique identifier of the entity
   */
  id: TId;
}

/**
 * Standalone creation audit fields without entity identity
 * Use this for composite primary keys or non-ID primary key scenarios
 *
 * @template TId - Identifier type, defaults to string
 * @template TDate - Date type, defaults to string (compatible with most API response formats)
 */
export interface CreationTracked<TId = string, TDate = string> {
  /**
   * Creation timestamp
   */
  createdAt: TDate;
  /**
   * Creator user ID
   */
  createdBy: TId;
  /**
   * Creator user name
   */
  createdByName: string;
}

/**
 * Standalone full audit fields without entity identity
 * Extends CreationTracked with update timestamp and updater details
 * Use this for composite primary keys or non-ID primary key scenarios
 *
 * @template TId - Identifier type, defaults to string
 * @template TDate - Date type, defaults to string (compatible with most API response formats)
 */
export interface FullTracked<TId = string, TDate = string> extends CreationTracked<TId, TDate> {
  /**
   * Last update timestamp
   */
  updatedAt: TDate;
  /**
   * Last updater user ID
   */
  updatedBy: TId;
  /**
   * Last updater user name
   */
  updatedByName: string;
}

/**
 * Entity with creation audit information
 * Composes Entity with CreationTracked fields
 *
 * @template TId - Identifier type, defaults to string
 * @template TDate - Date type, defaults to string (compatible with most API response formats)
 */
export interface CreationAuditedEntity<TId = string, TDate = string> extends Entity<TId>, CreationTracked<TId, TDate> {}

/**
 * Entity with full audit information including creation and last update details
 * Composes Entity with FullTracked fields
 * Suitable for business entities that require full audit trails
 *
 * @template TId - Identifier type, defaults to string
 * @template TDate - Date type, defaults to string (compatible with most API response formats)
 */
export interface FullAuditedEntity<TId = string, TDate = string> extends Entity<TId>, FullTracked<TId, TDate> {}

/**
 * Wrapper type for batch operations (create/update)
 * Provides a convenient way to define parameters for APIs that handle multiple items at once
 *
 * @template T - The type of items in the batch operation
 * @example
 * ```typescript
 * // API parameter for batch creating users
 * interface CreateManyUsersParams extends Many<CreateUserParams> {}
 *
 * // API parameter for batch updating products
 * interface UpdateManyProductsParams extends Many<UpdateProductParams> {}
 * ```
 */
export interface Many<T> {
  /**
   * List of items to be processed in the batch operation
   */
  list: T[];
}
