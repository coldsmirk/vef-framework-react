import type { ReactNode } from "react";

import type { CodeSetDescriptor } from "../types";

import { isDeepEqual } from "@vef-framework-react/shared";
import { createContext, use, useRef } from "react";

const EMPTY_CATALOG: CodeSetDescriptor[] = [];

const CodeSetCatalogContext = createContext<CodeSetDescriptor[]>(EMPTY_CATALOG);
CodeSetCatalogContext.displayName = "CodeSetCatalogContext";

/**
 * Publishes the host's data-dictionary catalog to the `codeSet` option-source
 * editors, which offer it as a picker. Design-time metadata only — the runtime
 * reads the code set key stored in the schema, never this catalog.
 */
export function CodeSetCatalogProvider({
  codeSets,
  children
}: {
  codeSets: CodeSetDescriptor[] | undefined;
  children: ReactNode;
}): ReactNode {
  // Content-stable identity, so a host passing an inline catalog literal does
  // not re-render every option-source editor per host render (the render-phase
  // ref write is idempotent, as in DataSourceApisProvider).
  const ref = useRef<CodeSetDescriptor[]>(EMPTY_CATALOG);
  const next = codeSets ?? EMPTY_CATALOG;

  if (ref.current !== next && !isDeepEqual(ref.current, next)) {
    ref.current = next;
  }

  return <CodeSetCatalogContext value={ref.current}>{children}</CodeSetCatalogContext>;
}

/**
 * The host's data-dictionary catalog, empty when none was provided.
 */
export function useCodeSetCatalog(): CodeSetDescriptor[] {
  return use(CodeSetCatalogContext);
}
