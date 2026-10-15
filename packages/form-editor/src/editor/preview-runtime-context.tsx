import type { ReactNode } from "react";

import type { CodeSetQueryFn, DataSourceResolver, EvaluationContext, LinkageEvaluators } from "../types";

import { createContext, use, useCallback, useMemo, useState } from "react";

import { withContextValues } from "../engine/linkage/scope";
import { useContextSources } from "./context-sources";

/**
 * Host-injected runtime capabilities the editor's live preview (and JSON split
 * render) need so the in-designer `FormRenderer` behaves like the deployed form:
 * remote / ref data sources resolve, a custom linkage engine runs, and the host
 * evaluation scope (`$user` / `$node` / `$applicant` / `$globals`) is present.
 * Mirrors the slots `FormRendererProps` already exposes; the editor only
 * forwards them.
 */
export interface PreviewRuntime {
  evaluators?: LinkageEvaluators;
  dataSourceResolver?: DataSourceResolver;
  codeSetQueryFn?: CodeSetQueryFn;
  evaluationContext?: EvaluationContext;
}

/**
 * The designer's preview samples for the host's system variables, keyed by
 * scope path (`$applicant.departmentId`). Design-time only: they never enter
 * the schema, and they exist so a rule about the initiator can be tried in the
 * preview before any real initiator exists.
 */
export interface PreviewSamples {
  samples: ReadonlyMap<string, string>;
  /**
   * Set a sample, or clear it with an empty string.
   */
  setSample: (path: string, value: string) => void;
}

const PreviewRuntimeContext = createContext<PreviewRuntime>({});
PreviewRuntimeContext.displayName = "PreviewRuntimeContext";

const PreviewSamplesContext = createContext<PreviewSamples | null>(null);
PreviewSamplesContext.displayName = "PreviewSamplesContext";

const NO_SAMPLES: ReadonlyMap<string, string> = new Map();

function noopSetSample(): void {
  // Outside a provider there is no preview to feed.
}

const DETACHED_SAMPLES: PreviewSamples = { samples: NO_SAMPLES, setSample: noopSetSample };

/**
 * A sample is typed as text, so read it the way the designer means it: `500`
 * is a number, `true` a boolean, `{"a":1}` an object, and anything that is not
 * JSON (`张三`, `dept-01`) stays the text it is.
 */
function parseSample(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Publishes the preview runtime: the host's capabilities, with the designer's
 * samples laid over the host evaluation context. Only samples for currently
 * declared system variables apply, so a variable the host stops declaring
 * cannot keep steering the preview from a panel that no longer shows it.
 */
export function PreviewRuntimeProvider({
  children,
  value
}: {
  children: ReactNode;
  value: PreviewRuntime;
}): ReactNode {
  const contextSources = useContextSources();
  const [samples, setSamples] = useState<ReadonlyMap<string, string>>(NO_SAMPLES);

  const setSample = useCallback((path: string, sample: string) => {
    setSamples(previous => {
      if ((previous.get(path) ?? "") === sample) {
        return previous;
      }

      const next = new Map(previous);

      if (sample.length === 0) {
        next.delete(path);
      } else {
        next.set(path, sample);
      }

      return next;
    });
  }, []);

  const evaluationContext = useMemo(
    () => withContextValues(
      value.evaluationContext,
      new Map(contextSources.flatMap(source => {
        const sample = samples.get(source.key);

        return sample === undefined ? [] : [[source.key, parseSample(sample)] as const];
      }))
    ),
    [value.evaluationContext, contextSources, samples]
  );

  const runtime = useMemo<PreviewRuntime>(
    () => {
      return {
        dataSourceResolver: value.dataSourceResolver,
        codeSetQueryFn: value.codeSetQueryFn,
        evaluators: value.evaluators,
        evaluationContext
      };
    },
    [value.dataSourceResolver, value.codeSetQueryFn, value.evaluators, evaluationContext]
  );

  const previewSamples = useMemo<PreviewSamples>(
    () => {
      return { samples, setSample };
    },
    [samples, setSample]
  );

  return (
    <PreviewRuntimeContext value={runtime}>
      <PreviewSamplesContext value={previewSamples}>{children}</PreviewSamplesContext>
    </PreviewRuntimeContext>
  );
}

/**
 * The host-injected preview runtime, defaulting to an empty bundle (every slot
 * falls back to the renderer's own no-op default).
 */
export function usePreviewRuntime(): PreviewRuntime {
  return use(PreviewRuntimeContext);
}

/**
 * The designer's preview samples and their setter. Outside a provider the
 * samples are empty and setting one does nothing.
 */
export function usePreviewSamples(): PreviewSamples {
  return use(PreviewSamplesContext) ?? DETACHED_SAMPLES;
}
