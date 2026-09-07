import type { ReactElement, ReactNode } from "react";

import type { ParamEvaluator } from "../engine/data-source-params";
import type { RuntimeFormValues } from "../runtime/types";
import type { DynamicValue, EvaluationContext, LinkageEvaluators } from "../types";

import { createContext, use, useMemo } from "react";

import { resolveLinkageEvaluators } from "../engine/linkage";

/**
 * What a bound data-source parameter is evaluated against: the live form values
 * plus the same evaluation context and evaluator seam the linkage engine uses,
 * so an expression means exactly the same thing in both places.
 */
export interface DataSourceParamScope {
  values: RuntimeFormValues;
  context?: EvaluationContext;
  /**
   * Already defaulted through `resolveLinkageEvaluators`, so a host that wires
   * none still gets the built-in expression runtime here — exactly as linkage
   * conditions do. Reading the host's raw overrides instead would make a bound
   * parameter silently unresolvable on every form that does not override.
   */
  evaluators: Required<LinkageEvaluators>;
}

const DataSourceParamScopeContext = createContext<DataSourceParamScope | undefined>(undefined);
DataSourceParamScopeContext.displayName = "DataSourceParamScopeContext";

/**
 * Publishes the evaluation scope for bound data-source parameters.
 *
 * Mounted by `LinkageScope`, once per VALUE SCOPE — the root form and every
 * subform row — with that scope's own values. A row must publish its own or a
 * bound parameter inside a repeated row resolves against the whole form, where
 * the row's keys do not exist: the parameter drops out (an unresolved parameter
 * is omitted, not sent empty), every row issues the same unfiltered request,
 * and because the cache is keyed on the resolved request they all collapse onto
 * one shared option list. Per-row cascading becomes structurally impossible
 * rather than merely wrong once. The effect lane already scoped its own
 * `resolveRequest` this way, so the two lanes now answer identically — which is
 * what the contract claims.
 *
 * `values` is `undefined` when the schema binds no parameter at all, which
 * publishes no scope and keeps every select out of the keystroke render path —
 * the same concern that makes the runtime state map reference-stabilized before
 * it reaches fields.
 */
export function DataSourceParamScopeProvider({
  children,
  context,
  evaluators,
  values
}: {
  children: ReactNode;
  values: RuntimeFormValues | undefined;
  evaluators?: LinkageEvaluators;
  context?: EvaluationContext;
}): ReactElement {
  const resolvedEvaluators = useMemo(() => resolveLinkageEvaluators(evaluators), [evaluators]);
  const scope = useMemo<DataSourceParamScope | undefined>(
    () => values === undefined
      ? undefined
      : {
          values,
          context,
          evaluators: resolvedEvaluators
        },
    [values, context, resolvedEvaluators]
  );

  return <DataSourceParamScopeContext value={scope}>{children}</DataSourceParamScopeContext>;
}

/**
 * The current scope for bound parameters, or `undefined` outside a provider —
 * the editor canvas, or a bare `FormRenderer` in a test — where a bound
 * parameter resolves to `undefined` rather than erroring, exactly as a remote
 * source without a resolver yields an empty list.
 */
export function useDataSourceParamScope(): DataSourceParamScope | undefined {
  return use(DataSourceParamScopeContext);
}

/**
 * Build the evaluator for one scope. A literal is carried verbatim; an
 * expression goes through the host's `evaluateAssignExpression` — the same seam
 * a linkage `assign` uses, so one expression language covers both.
 */
export function paramEvaluatorFor(scope: DataSourceParamScope | undefined): ParamEvaluator {
  return (param: DynamicValue) => {
    if (param.kind === "literal") {
      return param.value;
    }

    if (!scope) {
      return;
    }

    return scope.evaluators.evaluateAssignExpression(param.source, scope.values, scope.context);
  };
}
