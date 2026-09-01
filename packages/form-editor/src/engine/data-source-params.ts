import type { DynamicValue, RemoteDataSourceRequest, ResolvedDataSourceRequest, RuntimeSchema } from "../types";

import { walkFields } from "./schema/walk";

/**
 * Evaluates one bound parameter. Both lanes that resolve a request — the
 * option resolver and the `api_call` effect — supply their own, so the
 * resolution rule below is written once.
 */
export type ParamEvaluator = (param: DynamicValue) => unknown;

/**
 * Whether a request binds any parameter to the form. A request with only fixed
 * parameters resolves to itself, which is what lets the runtime skip
 * subscribing to form values for it at all.
 */
export function hasBoundParams(request: RemoteDataSourceRequest): boolean {
  return Object.values(request.params ?? {}).some(param => param.kind === "expression");
}

/**
 * Whether anything in the schema binds a data-source parameter to the form: a
 * form-global source, a field's inline remote source, or an `api_call` effect.
 * Computed once per schema so a form that binds nothing never pays for the
 * values subscription the scope provider would otherwise open.
 */
export function schemaHasBoundParams(schema: RuntimeSchema): boolean {
  if ((schema.dataSources ?? []).some(source => source.kind === "remote" && hasBoundParams(source.request))) {
    return true;
  }

  let bound = false;

  walkFields(schema, field => {
    if (bound) {
      return;
    }

    const source = "dataSource" in field ? field.dataSource : undefined;

    if (source?.kind === "remote" && hasBoundParams(source.request)) {
      bound = true;

      return;
    }

    const rules = field.linkage?.rules ?? [];

    for (const rule of rules) {
      for (const action of rule.actions) {
        if (action.type === "api_call" && hasBoundParams(action.request)) {
          bound = true;

          return;
        }
      }
    }
  });

  return bound;
}

/**
 * Resolve a request's parameters to concrete values, so whoever performs the
 * call — a {@link DataSourceResolver}, a host `api_call` handler — only ever
 * sees plain data and stays transport-only.
 *
 * A parameter resolving to `undefined` is omitted rather than sent — an
 * expression reading a key the form does not carry, or any expression at all
 * when no evaluator is wired. Sending the key with an `undefined` value would
 * put a hole on the wire the backend has to special-case; omitting it says the
 * same thing in the vocabulary every transport already understands. An empty
 * value the form really holds (`""`) is a value, not an absence, and is sent.
 */
export function resolveRequestParams(
  request: RemoteDataSourceRequest,
  evaluate: ParamEvaluator
): ResolvedDataSourceRequest {
  const {
    params,
    ...rest
  } = request;

  if (!params) {
    return rest;
  }

  const resolved: Record<string, unknown> = {};
  const entries = Object.entries(params);

  for (const [key, param] of entries) {
    const value = evaluate(param);

    if (value !== undefined) {
      resolved[key] = value;
    }
  }

  return {
    ...rest,
    params: resolved
  };
}
