import type { ReactNode } from "react";

import type { DataSourceApi, RemoteDataSourceRequest } from "../types";

import { isDeepEqual } from "@vef-framework-react/shared";
import { createContext, use, useRef } from "react";

const EMPTY_APIS: DataSourceApi[] = [];

const DataSourceApisContext = createContext<DataSourceApi[]>(EMPTY_APIS);
DataSourceApisContext.displayName = "DataSourceApisContext";

/**
 * Publishes the host's API catalog to the remote option-source editors, which
 * offer it as a picker. Design-time metadata only — the runtime reads the
 * request stored in the schema, never this catalog.
 */
export function DataSourceApisProvider({
  apis,
  children
}: {
  apis: DataSourceApi[] | undefined;
  children: ReactNode;
}): ReactNode {
  // Content-stable identity, so a host passing an inline catalog literal does
  // not re-render every option-source editor per host render (the render-phase
  // ref write is idempotent, as in ContextSourcesProvider).
  const ref = useRef<DataSourceApi[]>(EMPTY_APIS);
  const next = apis ?? EMPTY_APIS;

  if (ref.current !== next && !isDeepEqual(ref.current, next)) {
    ref.current = next;
  }

  return <DataSourceApisContext value={ref.current}>{children}</DataSourceApisContext>;
}

/**
 * The host's API catalog, empty when none was provided.
 */
export function useDataSourceApis(): DataSourceApi[] {
  return use(DataSourceApisContext);
}

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
