import type { ReactNode } from "react";

import type { CodeSetQueryFn, EvaluationContext, FormServices, LinkageEvaluators } from "../types";

import { createContext, use, useCallback, useMemo, useState } from "react";

import { withContextValues } from "../engine/linkage/scope";
import { useContextSources } from "./context-sources";

/**
 * Which host services are wired in production (before preview overrides
 * `navigate` with a toast). Used by the linkage designer to gate `api_call`
 * and `navigate` creation so authored actions always have a live backing.
 */
export interface ServiceCapabilities {
  hasRequest: boolean;
  hasNavigate: boolean;
}

/**
 * Host-injected runtime capabilities the editor's live preview (and JSON split
 * render) need so the in-designer `FormRenderer` behaves like the deployed form.
 */
export interface PreviewRuntime {
  evaluators?: LinkageEvaluators;
  services?: FormServices;
  serviceCapabilities?: ServiceCapabilities;
  codeSetQueryFn?: CodeSetQueryFn;
  evaluationContext?: EvaluationContext;
}

export interface PreviewSamples {
  samples: ReadonlyMap<string, string>;
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

function parseSample(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

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
        services: value.services,
        serviceCapabilities: value.serviceCapabilities,
        codeSetQueryFn: value.codeSetQueryFn,
        evaluators: value.evaluators,
        evaluationContext
      };
    },
    [value.services, value.serviceCapabilities, value.codeSetQueryFn, value.evaluators, evaluationContext]
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

export function usePreviewRuntime(): PreviewRuntime {
  return use(PreviewRuntimeContext);
}

export function usePreviewSamples(): PreviewSamples {
  return use(PreviewSamplesContext) ?? DETACHED_SAMPLES;
}
