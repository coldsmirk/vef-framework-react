import type { DynamicValue, FieldLinkage, RemoteDataSourceRequest, ResolvedDataSourceRequest, RuntimeSchema } from "../types";

import { getActionRequests } from "./linkage/action-descriptors";
import { linkageRules, ruleActions } from "./linkage/shape";
import { getNodeOptionSource } from "./options";
import { walkNodes } from "./schema/walk";
import { isRecord } from "./validation";

/**
 * Evaluates one bound parameter. Both lanes that resolve a request — the
 * option resolver and the `api_call` effect — supply their own, so the
 * resolution rule below is written once.
 */
export type ParamEvaluator = (param: DynamicValue) => unknown;

/**
 * Whether a request binds any parameter to the live form or context (`reference`
 * or `expression`). A request with only literal parameters resolves to itself,
 * letting the runtime skip subscribing to form values for it.
 */
export function hasBoundParams(request: RemoteDataSourceRequest): boolean {
  if (!isRecord(request) || !isRecord(request.params)) {
    return false;
  }

  return Object.values(request.params).some(
    param => isRecord(param) && (param.kind === "expression" || param.kind === "reference")
  );
}

function linkageHasBoundParams(linkage: FieldLinkage | undefined): boolean {
  for (const rule of linkageRules(linkage)) {
    for (const action of ruleActions(rule)) {
      for (const slot of getActionRequests(action)) {
        if (isRecord(slot.request) && hasBoundParams(slot.request as unknown as RemoteDataSourceRequest)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Whether anything in the schema binds a data-source parameter to the form: a
 * form-global source, a field's inline remote source, or any linkage action
 * carrying a request (both form-level `schema.linkage` and node-level linkage,
 * traversed via action descriptors).
 */
export function schemaHasBoundParams(schema: RuntimeSchema): boolean {
  if ((schema.dataSources ?? []).some(source => source.kind === "remote" && hasBoundParams(source.request))) {
    return true;
  }

  if (linkageHasBoundParams(schema.linkage)) {
    return true;
  }

  let bound = false;

  walkNodes(schema, node => {
    if (bound) {
      return;
    }

    const source = getNodeOptionSource(node);

    if (source?.kind === "remote" && hasBoundParams(source.request)) {
      bound = true;

      return;
    }

    if (linkageHasBoundParams(node.linkage)) {
      bound = true;
    }
  });

  return bound;
}

/**
 * Resolve a request's parameters to concrete values, so whoever performs the
 * call (`FormServices.request`) only ever sees plain data and stays
 * transport-only.
 *
 * A parameter resolving to `undefined` is omitted rather than sent — a
 * reference or expression reading an absent key (or any expression when no
 * evaluator is wired). Sending the key with an `undefined` value would put a
 * hole on the wire the backend has to special-case; omitting it says the same
 * thing in the vocabulary every transport already understands. An empty value
 * the form really holds (`""`) is a value, not an absence, and is sent.
 */
export function resolveRequestParams(
  request: RemoteDataSourceRequest,
  evaluate: ParamEvaluator
): ResolvedDataSourceRequest {
  const {
    params,
    ...rest
  } = request;

  if (!isRecord(params)) {
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
