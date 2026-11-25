import type { DataSourceApi, RemoteDataSourceRequest } from "../types";

/**
 * The identity of an endpoint: what a stored request and a catalog entry are
 * matched on. An omitted version and an empty one are the same endpoint.
 */
export function endpointKey(endpoint: Pick<RemoteDataSourceRequest, "action" | "resource" | "version">): string {
  return [endpoint.resource, endpoint.action, endpoint.version ?? ""].join("\u{0}");
}

/**
 * The catalog entry a stored request was picked from, if any.
 */
export function findDataSourceApi(apis: readonly DataSourceApi[], request: RemoteDataSourceRequest): DataSourceApi | undefined {
  const key = endpointKey(request);

  return apis.find(api => endpointKey(api) === key);
}
