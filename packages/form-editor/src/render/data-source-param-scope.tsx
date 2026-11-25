import type { ReactElement, ReactNode } from "react";

import type { ParamEvaluator } from "../engine/data-source-params";
import type { RuntimeFormValues } from "../runtime/types";
import type { DynamicValue, EvaluationContext, LinkageEvaluators } from "../types";

import { createContext, use, useMemo } from "react";

import { resolveActionValue, resolveLinkageEvaluators } from "../engine/linkage";

/**
 * What a bound data-source parameter is evaluated against: the live form values
 * plus the same evaluation context and evaluator seam the linkage engine uses,
 * so references and expressions mean exactly the same thing in both places.
 */
export interface DataSourceParamScope {
  values: RuntimeFormValues;
  context?: EvaluationContext;
  evaluators: Required<LinkageEvaluators>;
}

const DataSourceParamScopeContext = createContext<DataSourceParamScope | undefined>(undefined);
DataSourceParamScopeContext.displayName = "DataSourceParamScopeContext";

/**
 * Publishes the evaluation scope for bound data-source parameters, once per
 * value scope (root form and every subform row).
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
 * parameter resolves to `undefined` rather than erroring.
 */
export function useDataSourceParamScope(): DataSourceParamScope | undefined {
  return use(DataSourceParamScopeContext);
}

/**
 * Build the evaluator for one scope. Literals carry verbatim; references and
 * expressions evaluate through {@link resolveActionValue} with `allowSteps:
 * false` (step outputs do not exist outside effect sequences).
 */
export function paramEvaluatorFor(scope: DataSourceParamScope | undefined): ParamEvaluator {
  return (param: DynamicValue) => {
    if (param.kind === "literal") {
      return param.value;
    }

    if (!scope) {
      return;
    }

    return resolveActionValue(param, scope.values, scope.evaluators, scope.context, { allowSteps: false });
  };
}
