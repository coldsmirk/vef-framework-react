import type { ReactNode } from "react";

import type { DataSourceResolver, EvaluationContext, LinkageEvaluators } from "../types";

import { createContext, use, useMemo } from "react";

/**
 * Host-injected runtime capabilities the editor's live preview (and JSON split
 * render) need so the in-designer `FormRenderer` behaves like the deployed form:
 * remote / ref data sources resolve, a custom linkage engine runs, and the host
 * evaluation scope (`$user` / `$node`) is present. Mirrors the slots
 * `FormRendererProps` already exposes; the editor only forwards them.
 */
export interface PreviewRuntime {
  evaluators?: LinkageEvaluators;
  dataSourceResolver?: DataSourceResolver;
  evaluationContext?: EvaluationContext;
}

const PreviewRuntimeContext = createContext<PreviewRuntime>({});
PreviewRuntimeContext.displayName = "PreviewRuntimeContext";

export function PreviewRuntimeProvider({
  children,
  value
}: {
  children: ReactNode;
  value: PreviewRuntime;
}): ReactNode {
  const stable = useMemo<PreviewRuntime>(
    () => {
      return {
        dataSourceResolver: value.dataSourceResolver,
        evaluators: value.evaluators,
        evaluationContext: value.evaluationContext
      };
    },
    [value.dataSourceResolver, value.evaluators, value.evaluationContext]
  );

  return <PreviewRuntimeContext value={stable}>{children}</PreviewRuntimeContext>;
}

/**
 * The host-injected preview runtime, defaulting to an empty bundle (every slot
 * falls back to the renderer's own no-op default).
 */
export function usePreviewRuntime(): PreviewRuntime {
  return use(PreviewRuntimeContext);
}
