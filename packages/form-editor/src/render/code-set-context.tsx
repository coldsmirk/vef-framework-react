import type { DataOption } from "@vef-framework-react/core";
import type { ReactElement, ReactNode } from "react";

import type { CodeSetQueryFn, FieldOption } from "../types";

import { useAppContext, useQuery } from "@vef-framework-react/core";
import { createContext, use, useEffect, useState } from "react";

/**
 * The state of a form's batched dictionary load.
 */
export interface CodeSetState {
  /**
   * Each loaded code set's options, keyed by code set; absent until the load
   * succeeds.
   */
  options?: Readonly<Record<string, FieldOption[]>>;
  loading: boolean;
  error: boolean;
}

const IDLE: CodeSetState = { loading: false, error: false };

const CodeSetContext = createContext<CodeSetState>(IDLE);
CodeSetContext.displayName = "CodeSetContext";

/**
 * Loads the code sets a form reads in one batched call and publishes them to
 * its `codeSet` option sources. `queryFn` falls back to the application's
 * `AppContext.codeSetQueryFn`; without either, or without a code set to load,
 * nothing is fetched and every `codeSet` source resolves to an empty list.
 *
 * The load runs in a sibling that mounts only when there is something to
 * fetch: it is a TanStack query, and a form that reads no dictionary must not
 * need a `QueryClient` above it. Keeping it a sibling also keeps `children` in
 * the same tree position whether it is mounted or not, so the form below never
 * remounts.
 */
export function CodeSetProvider({
  children,
  codeSets,
  queryFn
}: {
  children: ReactNode;
  /**
   * The code set keys to load, sorted (see `collectCodeSets`).
   */
  codeSets: readonly string[];
  queryFn?: CodeSetQueryFn;
}): ReactElement {
  const { codeSetQueryFn } = useAppContext();
  const fn = queryFn ?? codeSetQueryFn;
  const [state, setState] = useState<CodeSetState>(IDLE);
  const active = fn !== undefined && codeSets.length > 0;

  return (
    <>
      {active ? <CodeSetLoader codeSets={codeSets} queryFn={fn} onStateChange={setState} /> : null}
      <CodeSetContext value={active ? state : IDLE}>{children}</CodeSetContext>
    </>
  );
}

function CodeSetLoader({
  codeSets,
  queryFn,
  onStateChange
}: {
  codeSets: readonly string[];
  queryFn: CodeSetQueryFn;
  onStateChange: (state: CodeSetState) => void;
}): null {
  const {
    data,
    isError,
    isLoading
  } = useQuery({
    // The key `useCodeSetQuery` builds, so a dictionary already loaded by the
    // application is served from the cache.
    queryKey: [queryFn.key, [...codeSets]],
    queryFn,
    select: toFieldOptions,
    staleTime: Infinity
  });

  useEffect(() => {
    onStateChange({
      options: data,
      loading: isLoading,
      error: isError
    });
  }, [data, isError, isLoading, onStateChange]);

  return null;
}

/**
 * Reduce each dictionary to the options a selection field offers: its
 * top-level entries' labels and values. A tree dictionary's children are not
 * flattened in — a select would otherwise list every node of, say, an
 * administrative-division tree.
 */
function toFieldOptions(data: Record<string, DataOption[]>): Record<string, FieldOption[]> {
  return Object.fromEntries(
    Object.entries(data).map(([codeSet, entries]) => [
      codeSet,
      entries.map(entry => { return { label: entry.label, value: entry.value }; })
    ])
  );
}

/**
 * The form's dictionary load, as `useFieldOptions` reads it.
 */
export function useCodeSetState(): CodeSetState {
  return use(CodeSetContext);
}
