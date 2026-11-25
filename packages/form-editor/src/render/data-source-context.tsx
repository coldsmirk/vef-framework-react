import type { ReactElement, ReactNode } from "react";

import type { KnownOptionsLookup } from "../runtime/action-executor";
import type {
  FieldOption,
  FieldOptionSource,
  FormDataSource,
  FormServices,
  RemoteDataSourceRequest,
  RemoteOptionMapping,
  ResolvedDataSourceRequest
} from "../types";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolveRequestParams } from "../engine/data-source-params";
import { resolveActionValue } from "../engine/linkage";
import { walkOwnPath } from "../engine/linkage/scope";
import { normalizeOptionMapping } from "../engine/option-mapping";
import { toTopLevelOptions } from "../engine/options";
import { isRecord } from "../engine/validation";
import { useCodeSetState } from "./code-set-context";
import { paramEvaluatorFor, useDataSourceParamScope } from "./data-source-param-scope";

interface InflightEntry {
  promise: Promise<FieldOption[]>;
  controller: AbortController;
  subscribers: number;
}

interface DataSourceContextValue {
  dataSources: FormDataSource[];
  request: FormServices["request"];
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
  /**
   * In-flight remote fetches keyed by the same `cacheKey` as {@link cache}, so
   * concurrent consumers (e.g. multiple rows of a subform sharing one remote
   * option column) share a single request instead of fanning out N times, and
   * abort only when the last active consumer unmounts or switches key.
   */
  inflight: Map<string, InflightEntry>;
}

const EMPTY_VERSIONS: Record<string, number> = {};
// Stable empty fallback: a version bump recomputes the provider's memo, and a
// fresh `[]` each time would churn the context `dataSources` reference,
// spuriously re-resolving every field's options. A constant keeps it stable.
const EMPTY_DATA_SOURCES: FormDataSource[] = [];
// Cache backing the provider-less default context (no request service wired).
const DEFAULT_CACHE = new Map<string, FieldOption[]>();
const DEFAULT_INFLIGHT = new Map<string, InflightEntry>();

const DataSourceContext = createContext<DataSourceContextValue>({
  dataSources: EMPTY_DATA_SOURCES,
  request: undefined,
  versions: EMPTY_VERSIONS,
  cache: DEFAULT_CACHE,
  inflight: DEFAULT_INFLIGHT
});
DataSourceContext.displayName = "DataSourceContext";

/**
 * Provides the form-global data sources and the host's unified `request`
 * service to selection fields below. Installed by `FormRenderer` (runtime) and
 * the editor canvas (design time) so `useFieldOptions` can resolve `ref` /
 * `remote` sources. Absent `request`, every remote source resolves to an empty
 * list rather than erroring.
 */
export function DataSourceProvider({
  children,
  dataSources,
  request,
  versions
}: {
  children: ReactNode;
  dataSources?: FormDataSource[];
  request?: FormServices["request"];
  /**
   * Refresh nonces from the runtime's data-source store. Omitted at design time
   * (the editor canvas), where nothing fires a `refresh_data_source` effect.
   */
  versions?: Record<string, number>;
}): ReactElement {
  // One cache + in-flight map per provider lifetime — survives consumer remounts by design.
  const [cache] = useState(() => new Map<string, FieldOption[]>());
  const [inflight] = useState(() => new Map<string, InflightEntry>());
  const value = useMemo<DataSourceContextValue>(
    () => {
      return {
        dataSources: dataSources ?? EMPTY_DATA_SOURCES,
        request,
        versions: versions ?? EMPTY_VERSIONS,
        cache,
        inflight
      };
    },
    [dataSources, request, versions, cache, inflight]
  );

  return <DataSourceContext value={value}>{children}</DataSourceContext>;
}

type ResolvedSource
  = | { kind: "static"; options: FieldOption[] }
    | { kind: "remote"; request: RemoteDataSourceRequest; mapping?: RemoteOptionMapping; refreshId?: string }
    | { kind: "codeSet"; codeSet: string };

/**
 * Collapse a field's option source to a static list, a concrete remote request,
 * or a code set, dereferencing a `ref` against form-global data sources with
 * the option mapping normalized so blank keys never reach mapping lookup. An
 * unknown reference resolves to an empty static list. A `ref` to a remote
 * source carries the source id as `refreshId`, so a `refresh_data_source`
 * action on that id forces a re-fetch; an inline `remote` source has no id and
 * cannot be a refresh target.
 */
function resolveSource(source: FieldOptionSource | undefined, dataSources: FormDataSource[]): ResolvedSource {
  if (!source || source.kind === "static") {
    return { kind: "static", options: source?.kind === "static" ? source.options : [] };
  }

  if (source.kind === "codeSet") {
    return { kind: "codeSet", codeSet: source.codeSet };
  }

  if (source.kind === "remote") {
    return {
      kind: "remote",
      request: source.request,
      mapping: normalizeOptionMapping(source.mapping)
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
        mapping: normalizeOptionMapping(found.mapping),
        refreshId: found.id
      };
}

function buildOptionCacheKey(
  refreshVersion: number,
  request: ResolvedDataSourceRequest,
  mapping: RemoteOptionMapping | undefined
): string {
  return `${refreshVersion}\u{0}${JSON.stringify(request)}\u{0}${JSON.stringify(mapping ?? null)}`;
}

function isOptionValue(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function isNonEmptyParentValue(value: unknown): value is string | number {
  return (typeof value === "string" && value.length > 0)
    || (typeof value === "number" && Number.isFinite(value));
}

interface ParsedOptionMapping {
  labelSegments: string[];
  valueSegments: string[];
  disabledSegments: string[];
  descriptionSegments: string[];
  childrenSegments: string[];
  parentSegments: string[] | undefined;
}

function parseOptionMapping(mapping: RemoteOptionMapping | undefined): ParsedOptionMapping {
  const normalized = normalizeOptionMapping(mapping);

  return {
    labelSegments: (normalized?.labelKey ?? "label").split("."),
    valueSegments: (normalized?.valueKey ?? "value").split("."),
    disabledSegments: (normalized?.disabledKey ?? "disabled").split("."),
    descriptionSegments: (normalized?.descriptionKey ?? "description").split("."),
    childrenSegments: (normalized?.childrenKey ?? "children").split("."),
    parentSegments: normalized?.parentKey === undefined ? undefined : normalized.parentKey.split(".")
  };
}

function buildOptionNode(row: Record<string, unknown>, parsed: ParsedOptionMapping): FieldOption | undefined {
  const rawValue = walkOwnPath(row, parsed.valueSegments);

  if (!isOptionValue(rawValue)) {
    return undefined;
  }

  const rawLabel = walkOwnPath(row, parsed.labelSegments);
  const rawDisabled = walkOwnPath(row, parsed.disabledSegments);
  const rawDescription = walkOwnPath(row, parsed.descriptionSegments);

  const option: FieldOption = {
    label: String(rawLabel ?? rawValue),
    value: rawValue
  };

  if (rawDisabled === true) {
    option.disabled = true;
  }

  if (typeof rawDescription === "string" && rawDescription.length > 0) {
    option.description = rawDescription;
  }

  return option;
}

function mapNestedRows(
  rows: readonly unknown[],
  parsed: ParsedOptionMapping,
  visited: WeakSet<object>
): FieldOption[] {
  const options: FieldOption[] = [];

  for (const row of rows) {
    if (!isRecord(row) || visited.has(row)) {
      continue;
    }

    const option = buildOptionNode(row, parsed);

    if (option === undefined) {
      continue;
    }

    visited.add(row);

    const rawChildren = walkOwnPath(row, parsed.childrenSegments);

    if (Array.isArray(rawChildren) && rawChildren.length > 0) {
      const children = mapNestedRows(rawChildren, parsed, visited);

      if (children.length > 0) {
        option.children = children;
      }
    }

    visited.delete(row);
    options.push(option);
  }

  return options;
}

interface FlatOptionEntry {
  option: FieldOption;
  key: string;
  parentKey: string | null;
}

/**
 * Whether `entry` lies on a cycle in the `parentKey` graph (walking ancestors
 * returns to `entry`). Cycle members become roots; non-cycle descendants that
 * merely point into a cycle hit a repeated cycle node without returning to
 * `entry`, so they stay attached beneath their parent.
 */
function isInFlatParentCycle(
  entry: FlatOptionEntry,
  byKey: ReadonlyMap<string, FlatOptionEntry>
): boolean {
  const seen = new Set<FlatOptionEntry>();
  let current = entry.parentKey === null ? undefined : byKey.get(entry.parentKey);

  while (current !== undefined) {
    if (current === entry) {
      return true;
    }

    if (seen.has(current)) {
      return false;
    }

    seen.add(current);
    current = current.parentKey === null ? undefined : byKey.get(current.parentKey);
  }

  return false;
}

/**
 * Assemble flat remote records into an option tree using `parentKey`:
 * - records whose parent is absent, empty, unknown, or self-referencing become roots;
 * - records participating in a parent cycle are promoted to roots (never looping),
 * while non-cycle descendants pointing at a cycle member stay attached beneath it.
 */
function buildFlatOptionTree(
  rows: readonly unknown[],
  parsed: ParsedOptionMapping,
  parentSegments: string[]
): FieldOption[] {
  const entries: FlatOptionEntry[] = [];
  const byKey = new Map<string, FlatOptionEntry>();

  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }

    const option = buildOptionNode(row, parsed);

    if (option === undefined) {
      continue;
    }

    const key = String(option.value);
    const rawParent = walkOwnPath(row, parentSegments);
    const candidateParent = isNonEmptyParentValue(rawParent) ? String(rawParent) : null;
    const parentKey = candidateParent === key ? null : candidateParent;
    const entry: FlatOptionEntry = {
      option,
      key,
      parentKey
    };

    entries.push(entry);

    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }

  const roots: FieldOption[] = [];

  for (const entry of entries) {
    const parent = entry.parentKey !== null && !isInFlatParentCycle(entry, byKey)
      ? byKey.get(entry.parentKey)
      : undefined;

    if (parent !== undefined && parent !== entry) {
      parent.option.children ??= [];
      parent.option.children.push(entry.option);
    } else {
      roots.push(entry.option);
    }
  }

  return roots;
}

/**
 * Map a raw remote response (an array of records or a framework paginated
 * `{ items: [...] }` object) into `FieldOption[]` using the source's mapping
 * (`labelKey` / `valueKey` / `disabledKey` / `descriptionKey` / `childrenKey` /
 * `parentKey`). When `parentKey` is set, flat records are assembled into a tree
 * and `childrenKey` is ignored; otherwise nested records recurse through
 * `childrenKey` (defaulting to `"children"`).
 */
export function mapRemoteResponseToOptions(raw: unknown, mapping?: RemoteOptionMapping): FieldOption[] {
  let rows: unknown[];

  if (Array.isArray(raw)) {
    rows = raw;
  } else if (isRecord(raw) && Array.isArray(raw.items)) {
    rows = raw.items;
  } else {
    return [];
  }

  const parsed = parseOptionMapping(mapping);

  return parsed.parentSegments === undefined
    ? mapNestedRows(rows, parsed, new WeakSet())
    : buildFlatOptionTree(rows, parsed, parsed.parentSegments);
}

const STATIC_RESULT = { loading: false, error: false } as const;
const NO_OPTIONS: FieldOption[] = [];

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
 * return synchronously from the schema; a `codeSet` source reads the form's
 * batched dictionary load (`CodeSetProvider`); `remote` (and `ref`-to-remote)
 * fetch through the host's `FormServices.request` and map the response via
 * {@link RemoteOptionMapping}, exposing a `loading` flag while the request is
 * in flight. The previously resolved options are kept while a refresh is in
 * flight (and after a failure), so a `refresh_data_source` action does not
 * blank every consuming select until the new response lands. A stale request
 * is ignored if the source changes first.
 */
export function useFieldOptions(source: FieldOptionSource | undefined): FieldOptionsResult {
  const {
    cache,
    dataSources,
    inflight,
    request: requestFn,
    versions
  } = use(DataSourceContext);
  const resolved = useMemo(() => resolveSource(source, dataSources), [source, dataSources]);
  const codeSets = useCodeSetState();
  // Bound parameters are evaluated here, before the request reaches the host
  // service: `services.request` stays transport-only, and because the cache key
  // below is the *resolved* request, a bound value changing re-fetches while an
  // unrelated edit does not.
  const paramScope = useDataSourceParamScope();
  const request = useMemo(
    () => resolved.kind === "remote"
      ? resolveRequestParams(resolved.request, paramEvaluatorFor(paramScope))
      : null,
    [resolved, paramScope]
  );
  // Refresh nonce for a `ref`-to-remote source: a `refresh_data_source` action
  // bumps it, re-running the fetch below against the same request. Inline
  // remote and static sources have no `refreshId`, so they pin to 0 and never
  // re-fetch.
  const refreshId = resolved.kind === "remote" ? resolved.refreshId : undefined;
  const mapping = resolved.kind === "remote" ? resolved.mapping : undefined;
  const refreshVersion = refreshId === undefined ? 0 : versions[refreshId] ?? 0;
  // Cache key: the concrete request (+ mapping) plus the refresh nonce, so a
  // refresh bump is a guaranteed miss while a plain remount is a hit.
  const cacheKey = useMemo(
    () => resolved.kind === "remote" && request !== null
      ? buildOptionCacheKey(refreshVersion, request, resolved.mapping)
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

    if (requestFn === undefined) {
      setRemote(prev => prev.options.length === 0 && !prev.loading && !prev.error
        ? prev
        : {
            options: [],
            loading: false,
            error: false
          });
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

    let entry = inflight.get(cacheKey);

    if (entry) {
      entry.subscribers += 1;
    } else {
      const controller = new AbortController();

      // Guard against synchronous throws and non-Promise returns from a host
      // `request` service so they converge into this source's `error` state
      // instead of crashing the enclosing React tree inside `useEffect`.
      const invokeRequest = (): Promise<unknown> => {
        try {
          const result: unknown = requestFn(currentRequest, { signal: controller.signal });

          if (
            result === null
            || (typeof result !== "object" && typeof result !== "function")
            || typeof (result as PromiseLike<unknown>).then !== "function"
          ) {
            return Promise.reject(new TypeError("FormServices.request must return a Promise"));
          }

          return Promise.resolve(result);
        } catch (error: unknown) {
          return Promise.reject(error);
        }
      };

      const promise = invokeRequest()
        .then(raw => {
          const options = mapRemoteResponseToOptions(raw, mapping);

          if (!controller.signal.aborted) {
            cache.set(cacheKey, options);
          }

          return options;
        })
        .catch((error: unknown) => {
          // Dev-visible signal logged once per failed request (not once per
          // waiting cell): a silently empty select after a request failure is
          // otherwise indistinguishable from a legitimately empty source.
          if (!controller.signal.aborted) {
            console.warn(
              `[form-editor] data source "${refreshId ?? "(inline remote)"}" failed to resolve:`,
              error
            );
          }

          throw error;
        })
        .finally(() => {
          if (inflight.get(cacheKey) === entry) {
            inflight.delete(cacheKey);
          }
        });

      entry = {
        promise,
        controller,
        subscribers: 1
      };
      inflight.set(cacheKey, entry);
    }

    const subscribedEntry = entry;

    subscribedEntry.promise
      .then(options => {
        if (!cancelled) {
          setRemote({
            options,
            loading: false,
            error: false
          });
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

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
      subscribedEntry.subscribers -= 1;

      if (subscribedEntry.subscribers <= 0 && inflight.get(cacheKey) === subscribedEntry) {
        inflight.delete(cacheKey);
        subscribedEntry.controller.abort();
      }
    };
    // `resolved` is deliberately absent: its mapping and refresh id are both
    // folded into `cacheKey`, and including the object would reintroduce the
    // per-render identity churn this fix removes.
  }, [cache, cacheKey, inflight, mapping, refreshId, requestFn]);

  switch (resolved.kind) {
    case "static": {
      return { options: resolved.options, ...STATIC_RESULT };
    }

    case "codeSet": {
      return {
        options: codeSets.options?.[resolved.codeSet] ?? NO_OPTIONS,
        loading: codeSets.loading,
        error: codeSets.error
      };
    }

    case "remote": {
      return remote;
    }
  }
}

/**
 * Resolve a flat selection control's top-level options (stripping nested
 * `children` while preserving `disabled` and `description`), memoized against
 * {@link useFieldOptions}.
 */
export function useTopLevelFieldOptions(source: FieldOptionSource | undefined): FieldOptionsResult {
  const {
    error,
    loading,
    options: rawOptions
  } = useFieldOptions(source);
  const options = useMemo(() => toTopLevelOptions(rawOptions), [rawOptions]);

  return useMemo(
    () => {
      return {
        options,
        loading,
        error
      };
    },
    [error, loading, options]
  );
}

/**
 * Returns a referentially-stable lookup function for `writeFieldValue` /
 * `normalizeFieldValue` to inspect a selection field's already-known options
 * (static, loaded codeSet, or cached remote) without subscribing the caller to
 * option-load re-renders.
 */
export function useKnownOptionsLookup(): KnownOptionsLookup {
  const dataSourceCtx = use(DataSourceContext);
  const codeSets = useCodeSetState();

  const dataSourceRef = useRef(dataSourceCtx);
  dataSourceRef.current = dataSourceCtx;
  const codeSetsRef = useRef(codeSets);
  codeSetsRef.current = codeSets;

  return useCallback<KnownOptionsLookup>((field, scopeValues, evaluationContext, evaluators) => {
    if (
      field.type !== "select"
      && field.type !== "radio"
      && field.type !== "multi-select"
      && field.type !== "checkbox-group"
      && field.type !== "tree-select"
      && field.type !== "tree-multi-select"
    ) {
      return;
    }

    const {
      cache,
      dataSources,
      versions
    } = dataSourceRef.current;
    const resolved = resolveSource(field.dataSource, dataSources);

    switch (resolved.kind) {
      case "static": {
        return resolved.options;
      }

      case "codeSet": {
        return codeSetsRef.current.options?.[resolved.codeSet];
      }

      case "remote": {
        const concrete = resolveRequestParams(
          resolved.request,
          param => resolveActionValue(param, scopeValues, evaluators, evaluationContext, { allowSteps: false })
        );
        const refreshVersion = resolved.refreshId === undefined ? 0 : versions[resolved.refreshId] ?? 0;
        const key = buildOptionCacheKey(refreshVersion, concrete, resolved.mapping);

        return cache.get(key);
      }
    }
  }, []);
}
