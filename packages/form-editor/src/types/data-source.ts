import type { DynamicValue } from "./dynamic-value";
import type { FieldOption } from "./schema";

/**
 * An RPC request describing where a selection field's options come from. The
 * shape matches the framework's resource/action/version addressing; the host's
 * resolver turns it into an actual fetch. Kept transport-agnostic so the form
 * editor never depends on a concrete `apiClient`.
 */
export interface RemoteDataSourceRequest {
  resource: string;
  action: string;
  version?: string;
  /**
   * Request parameters, each either a fixed value or an expression bound to the
   * live form. Expressions are evaluated by the form runtime **before** the
   * request reaches the resolver, so a {@link DataSourceResolver} always sees
   * concrete values and stays transport-only.
   *
   * Binding a parameter is what makes a cascading select work — "the wards of
   * the department picked above". The runtime keys its option cache on the
   * resolved request, so a bound value changing re-resolves the options and an
   * unrelated keystroke does not.
   */
  params?: Record<string, DynamicValue>;
}

/**
 * A request whose parameters have already been evaluated — what the form
 * runtime hands to a resolver or a host `api_call` handler. Splitting it from
 * {@link RemoteDataSourceRequest} keeps expression evaluation the runtime's
 * job: the schema type carries bindings, this one carries data, and nothing
 * downstream has to know an expression ever existed.
 */
export interface ResolvedDataSourceRequest {
  resource: string;
  action: string;
  version?: string;
  params?: Record<string, unknown>;
}

/**
 * How to read `{ label, value }` out of each raw remote record. Mirrors the
 * field-mapping of `@vef-framework-react/hooks` `useDataOptionsQuery`, so a host
 * resolver built on it maps one-to-one. Defaults: `label` / `value`.
 */
export interface RemoteOptionMapping {
  labelKey?: string;
  valueKey?: string;
  disabledKey?: string;
  descriptionKey?: string;
}

/**
 * One parameter a {@link DataSourceApi} takes. The designer lists it as a
 * named row the designer binds to a fixed value or an expression, instead of a
 * name typed by hand.
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
   * Bound into the request when the API is picked — a literal, or an
   * expression such as `$applicant.departmentId`.
   */
  defaultValue?: DynamicValue;
}

/**
 * One endpoint a host offers in the designer's API picker for remote option
 * sources — "部门列表" instead of a hand-typed resource / action pair. Picking
 * it copies the endpoint and its mapping into the schema, so a schema stays
 * self-contained: the runtime resolver and a backend projection read the
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
 * Host-injected resolver that turns a {@link RemoteDataSourceRequest} into a
 * concrete option list. The package ships a no-op default (returns `[]`) so it
 * has zero networking dependency; a host wires the real one on top of the
 * framework `apiClient` (and may cache through TanStack Query). Mirrors the
 * `LinkageEvaluators` host-injection philosophy.
 */
export interface DataSourceResolver {
  resolve: (request: ResolvedDataSourceRequest, mapping?: RemoteOptionMapping) => Promise<FieldOption[]>;
}

/**
 * The no-op resolver used when a host supplies none — remote sources resolve to
 * an empty list rather than erroring, exactly as the default linkage evaluator
 * returns a benign result.
 */
export const noopDataSourceResolver: DataSourceResolver = {
  resolve: () => Promise.resolve([])
};
