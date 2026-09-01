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
