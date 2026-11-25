import type { DataOption, QueryFunction } from "@vef-framework-react/core";

import type { DynamicValue } from "./dynamic-value";
import type { FieldOption } from "./schema";

/**
 * An RPC request describing where a selection field's options or an `api_call`
 * action's data come from. The shape matches the framework's
 * resource/action/version addressing; the host's {@link FormServices.request}
 * turns it into an actual fetch. Kept transport-agnostic so the form editor
 * never depends on a concrete `apiClient`.
 */
export interface RemoteDataSourceRequest {
  resource: string;
  action: string;
  version?: string;
  /**
   * Request parameters, each a literal, a scope-path reference, or an
   * expression bound to the live form. Bound values are evaluated by the form
   * runtime **before** the request reaches the host service, so
   * `FormServices.request` always sees concrete values and stays transport-only.
   *
   * Binding a parameter is what makes a cascading select work — "the teams of
   * the department picked above". The runtime keys its option cache on the
   * resolved request, so a bound value changing re-resolves the options and an
   * unrelated keystroke does not.
   */
  params?: Record<string, DynamicValue>;
}

/**
 * A request whose parameters have already been evaluated — what the form
 * runtime hands to {@link FormServices.request}. Splitting it from
 * {@link RemoteDataSourceRequest} keeps bound-value evaluation the runtime's
 * job: the schema type carries bindings, this one carries data, and nothing
 * downstream has to know a reference or expression ever existed.
 */
export interface ResolvedDataSourceRequest {
  resource: string;
  action: string;
  version?: string;
  params?: Record<string, unknown>;
}

/**
 * How to read `{ label, value }` out of each raw remote record. Mirrors the
 * field-mapping of `@vef-framework-react/hooks` `useDataOptionsQuery`.
 * Defaults: `label` / `value`.
 */
export interface RemoteOptionMapping {
  labelKey?: string;
  valueKey?: string;
  disabledKey?: string;
  descriptionKey?: string;
}

/**
 * One field of a record returned by a {@link DataSourceApi}. Design-time only:
 * the designer lists these as pickable paths when mapping step outputs; schemas
 * store the plain path string.
 */
export interface DataSourceApiField {
  path: string;
  label: string;
}

/**
 * One parameter a {@link DataSourceApi} takes. The designer lists it as a
 * named row the designer binds to a fixed value, reference, or expression,
 * instead of a name typed by hand.
 */
export interface DataSourceApiParam {
  /**
   * The parameter's name in the request (`params.<name>`).
   */
  name: string;
  /**
   * Display name, e.g. `"上级部门"`. Defaults to `name`.
   */
  label?: string;
  /**
   * One-line explanation shown under the row.
   */
  description?: string;
  /**
   * Marks the row as one the request needs. The designer flags it while it is
   * unbound; the request is still sent without it.
   */
  required?: boolean;
  /**
   * Bound into the request when the API is picked — a literal, reference, or
   * expression such as `$applicant.departmentId`.
   */
  defaultValue?: DynamicValue;
}

/**
 * One endpoint a host offers in the designer's API picker for remote option
 * sources and `api_call` actions — "部门列表" instead of a hand-typed resource /
 * action pair. Picking it copies the endpoint and its mapping into the schema,
 * so a schema stays self-contained: the runtime and backend projection read the
 * stored request and never need this catalog. A stored request is recognized
 * as an API again by its endpoint (`resource` + `action` + `version`), so a
 * catalog lists each endpoint once.
 */
export interface DataSourceApi {
  /**
   * Display name in the picker, e.g. `"部门列表"`.
   */
  label: string;
  /**
   * One-line explanation shown once the API is picked.
   */
  description?: string;
  /**
   * Picker group heading for a long catalog, e.g. `"组织架构"`.
   */
  group?: string;
  resource: string;
  action: string;
  version?: string;
  /**
   * How to read options out of this endpoint's records. Copied into the data
   * source on pick; omit when the records already carry `label` / `value`.
   */
  mapping?: RemoteOptionMapping;
  /**
   * The parameters the endpoint takes, in display order.
   */
  params?: DataSourceApiParam[];
  /**
   * Fields present on records returned by this endpoint, for the designer's
   * reference picker and column matching. Design-time only.
   */
  fields?: DataSourceApiField[];
}

/**
 * A form-global, reusable option source referenced by fields through their
 * `{ kind: "ref", dataSourceId }`.
 */
export type FormDataSource = StaticDataSource | RemoteDataSource;

export interface StaticDataSource {
  id: string;
  name: string;
  kind: "static";
  options: FieldOption[];
}

export interface RemoteDataSource {
  id: string;
  name: string;
  kind: "remote";
  request: RemoteDataSourceRequest;
  mapping?: RemoteOptionMapping;
}

/**
 * A form-global variable, surfaced to expressions as `$vars.<name>`.
 */
export interface FormVariable {
  id: string;
  /**
   * The `$vars` key. Must be a valid identifier.
   */
  name: string;
  type: "string" | "number" | "boolean" | "json";
  defaultValue?: unknown;
}

/**
 * Loads host data dictionaries (code sets) in one call: given a list of code
 * set keys, it answers each key's entries. The same contract as the
 * application's `AppContext.codeSetQueryFn`, which is the default wherever a
 * form takes one — and, run through TanStack Query under the same query key as
 * `useCodeSetQuery`, a dictionary loaded anywhere in the application is not
 * fetched again for a form.
 */
export type CodeSetQueryFn = QueryFunction<Record<string, DataOption[]>, string[]>;

/**
 * One data dictionary a host offers in the designer's picker for `codeSet`
 * option sources. Design-time only: a pick stores the key alone, so the
 * runtime and a backend projection never need this catalog.
 */
export interface CodeSetDescriptor {
  /**
   * The code set key the schema stores, e.g. `"sys.user.gender"`.
   */
  codeSet: string;
  /**
   * Display name in the picker, e.g. `"性别"`.
   */
  name: string;
  /**
   * Picker group heading for a long catalog, e.g. `"人事"`.
   */
  group?: string;
}
