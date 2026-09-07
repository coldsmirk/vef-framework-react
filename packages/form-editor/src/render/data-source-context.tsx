import type { ReactElement, ReactNode } from "react";

import type {
  DataSourceResolver,
  FieldOption,
  FieldOptionSource,
  FormDataSource,
  RemoteDataSourceRequest,
  RemoteOptionMapping
} from "../types";

import { createContext, use, useEffect, useMemo, useRef, useState } from "react";

import { resolveRequestParams } from "../engine/data-source-params";
import { noopDataSourceResolver } from "../types";
import { paramEvaluatorFor, useDataSourceParamScope } from "./data-source-param-scope";

interface DataSourceContextValue {
  dataSources: FormDataSource[];
  resolver: DataSourceResolver;
  /**
   * Per-data-source refresh nonce, keyed by id. A `refresh_data_source` effect
   * bumps a source's entry; `useFieldOptions` folds it into its fetch deps so a
   * referencing field re-resolves. Absent the runtime store every entry is 0.
   */
  versions: Record<string, number>;
  /**
   * Resolved remote option lists, keyed by request signature + refresh nonce.
   * Provider-scoped: a field that unmounts and remounts (the editor's
   * edit ⇄ preview Activity round-trip hides effects) reuses the prior
   * response instead of re-fetching every remote source, while a
   * `refresh_data_source` bump changes the key and still forces a fetch.
   */
  cache: Map<string, FieldOption[]>;
}

const EMPTY_VERSIONS: Record<string, number> = {};
// Stable empty fallback: a version bump recomputes the provider's memo, and a
// fresh `[]` each time would churn the context `dataSources` reference, spuriously
// re-resolving every field's options. A constant keeps the reference stable.
const EMPTY_DATA_SOURCES: FormDataSource[] = [];
// Cache backing the provider-less default context (noop resolver only).
const DEFAULT_CACHE = new Map<string, FieldOption[]>();

const DataSourceContext = createContext<DataSourceContextValue>({
  dataSources: EMPTY_DATA_SOURCES,
  resolver: noopDataSourceResolver,
  versions: EMPTY_VERSIONS,
  cache: DEFAULT_CACHE
});
DataSourceContext.displayName = "DataSourceContext";

/**
 * Provides the form-global data sources and the host's option resolver to the
 * selection fields below. Installed by `FormRenderer` (runtime) and the editor
 * canvas (design time) so `useFieldOptions` can resolve `ref` / `remote`
 * sources. Absent a provider the defaults make every remote source resolve to
 * an empty list rather than error.
 */
export function DataSourceProvider({
  children,
  dataSources,
  resolver,
  versions
}: {
  children: ReactNode;
  dataSources?: FormDataSource[];
  resolver?: DataSourceResolver;
  /**
   * Refresh nonces from the runtime's data-source store. Omitted at design time
   * (the editor canvas), where nothing fires a `refresh_data_source` effect.
   */
  versions?: Record<string, number>;
}): ReactElement {
  // One cache per provider lifetime — survives consumer remounts by design.
  const [cache] = useState(() => new Map<string, FieldOption[]>());
  const value = useMemo<DataSourceContextValue>(
    () => {
      return {
        dataSources: dataSources ?? EMPTY_DATA_SOURCES,
        resolver: resolver ?? noopDataSourceResolver,
        versions: versions ?? EMPTY_VERSIONS,
        cache
      };
    },
    [dataSources, resolver, versions, cache]
  );

  return <DataSourceContext value={value}>{children}</DataSourceContext>;
}

type ResolvedSource
  = | { kind: "static"; options: FieldOption[] }
    | { kind: "remote"; request: RemoteDataSourceRequest; mapping?: RemoteOptionMapping; refreshId?: string };

/**
 * Collapse a field's option source to a static list or a concrete remote
 * request, dereferencing a `ref` against the form-global data sources. An
 * unknown reference resolves to an empty static list. A `ref` to a remote source
 * carries the source id as `refreshId`, so a `refresh_data_source` effect on that
 * id forces a re-fetch; an inline `remote` source has no id and cannot be a
 * refresh target.
 */
function resolveSource(source: FieldOptionSource | undefined, dataSources: FormDataSource[]): ResolvedSource {
  if (!source || source.kind === "static") {
    return { kind: "static", options: source?.kind === "static" ? source.options : [] };
  }

  if (source.kind === "remote") {
    return {
      kind: "remote",
      request: source.request,
      mapping: source.mapping
    };
  }

  const found = dataSources.find(dataSource => dataSource.id === source.dataSourceId);

  if (!found) {
    return { kind: "static", options: [] };
  }

  return found.kind === "static"
    ? { kind: "static", options: found.options }
    : {
        kind: "remote",
        request: found.request,
        mapping: found.mapping,
        refreshId: found.id
      };
}

const STATIC_RESULT = { loading: false, error: false } as const;

/**
 * A field's resolved options plus the remote-fetch status flags.
 */
export interface FieldOptionsResult {
  options: FieldOption[];
  loading: boolean;
  /**
   * True when the latest resolve attempt rejected. The previous options are
   * kept (not blanked), so a consumer can keep rendering them and surface the
   * failure however it sees fit.
   */
  error: boolean;
}

/**
 * Resolve a selection field's options. Static (and `ref`-to-static) sources
 * return synchronously from the schema; `remote` (and `ref`-to-remote) sources
 * fetch through the host-injected resolver, exposing a `loading` flag while the
 * request is in flight. The previously resolved options are kept while a
 * refresh is in flight (and after a failure), so a `refresh_data_source` effect
 * does not blank every consuming select until the new response lands. A stale
 * request is ignored if the source changes first.
 */
export function useFieldOptions(source: FieldOptionSource | undefined): FieldOptionsResult {
  const {
    cache,
    dataSources,
    resolver,
    versions
  } = use(DataSourceContext);
  const resolved = useMemo(() => resolveSource(source, dataSources), [source, dataSources]);
  // Bound parameters are evaluated here, before the request reaches the
  // resolver: the resolver stays transport-only, and because the cache key
  // below is the *resolved* request, a bound value changing re-fetches while an
  // unrelated edit does not.
  const paramScope = useDataSourceParamScope();
  const request = useMemo(
    () => resolved.kind === "remote"
      ? resolveRequestParams(resolved.request, paramEvaluatorFor(paramScope))
      : null,
    [resolved, paramScope]
  );
  // Refresh nonce for a `ref`-to-remote source: a `refresh_data_source` effect
  // bumps it, re-running the fetch below against the same request. Inline remote
  // and static sources have no `refreshId`, so they pin to 0 and never re-fetch.
  const refreshId = resolved.kind === "remote" ? resolved.refreshId : undefined;
  const mapping = resolved.kind === "remote" ? resolved.mapping : undefined;
  const refreshVersion = refreshId === undefined ? 0 : versions[refreshId] ?? 0;
  // Cache key: the concrete request (+ mapping) plus the refresh nonce, so a
  // refresh bump is a guaranteed miss while a plain remount is a hit.
  const cacheKey = useMemo(
    () => resolved.kind === "remote" && request !== null
      ? `${refreshVersion}\u{0}${JSON.stringify(request)}\u{0}${JSON.stringify(resolved.mapping ?? null)}`
      : null,
    [resolved, request, refreshVersion]
  );
  const [remote, setRemote] = useState<FieldOptionsResult>(() => {
    // Seed from the provider cache so a remounted field paints its options on
    // the first frame instead of flashing empty until the effect runs.
    const cached = cacheKey === null ? undefined : cache.get(cacheKey);

    return {
      options: cached ?? [],
      loading: false,
      error: false
    };
  });

  // The effect below keys on `cacheKey` (a string) rather than on `request` (a
  // fresh object per render), so it re-runs exactly when the resolved request
  // actually changes. The request itself travels through a ref, which the
  // effect reads at fire time.
  const requestRef = useRef(request);

  requestRef.current = request;

  useEffect(() => {
    const currentRequest = requestRef.current;

    if (currentRequest === null || cacheKey === null) {
      return;
    }

    const cached = cache.get(cacheKey);

    if (cached) {
      // This exact request already resolved during the provider's lifetime
      // (e.g. an edit ⇄ preview round-trip remounted the field) — reuse it
      // without another network round trip.
      setRemote({
        options: cached,
        loading: false,
        error: false
      });
      return;
    }

    let cancelled = false;
    setRemote(prev => {
      return {
        options: prev.options,
        loading: true,
        error: false
      };
    });

    resolver.resolve(currentRequest, mapping)
      .then(options => {
        cache.set(cacheKey, options);

        if (!cancelled) {
          setRemote({
            options,
            loading: false,
            error: false
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        // Dev-visible signal: a silently empty select after a resolver failure
        // is otherwise indistinguishable from a legitimately empty source.
        console.warn(
          `[form-editor] data source "${refreshId ?? "(inline remote)"}" failed to resolve:`,
          error
        );
        setRemote(prev => {
          return {
            options: prev.options,
            loading: false,
            error: true
          };
        });
      });

    return () => {
      cancelled = true;
    };
    // `resolved` is deliberately absent: its mapping and refresh id are both
    // folded into `cacheKey`, and including the object would reintroduce the
    // per-render identity churn this fix removes.
  }, [cache, cacheKey, mapping, refreshId, resolver]);

  return resolved.kind === "static" ? { options: resolved.options, ...STATIC_RESULT } : remote;
}
