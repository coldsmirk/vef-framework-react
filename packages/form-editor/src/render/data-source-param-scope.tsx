import type { ReactElement, ReactNode } from "react";

import type { ParamEvaluator } from "../engine/data-source-params";
import type { RuntimeForm, RuntimeFormValues } from "../runtime/types";
import type { DynamicValue, EvaluationContext, LinkageEvaluators } from "../types";

import { useFormStore } from "@vef-framework-react/components";
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
 * The values subscription is selector-gated rather than conditional: with
 * `enabled` false the selector returns a constant, so a form that binds no
 * parameter never re-renders a select on a keystroke — the same concern that
 * makes the runtime state map reference-stabilized before it reaches fields.
 */
export function DataSourceParamScopeProvider({
  children,
  context,
  enabled,
  evaluators,
  form
}: {
  children: ReactNode;
  enabled: boolean;
  form: RuntimeForm;
  evaluators?: LinkageEvaluators;
  context?: EvaluationContext;
}): ReactElement {
  const values = useFormStore(form.store, state => enabled ? state.values : null);
  const resolvedEvaluators = useMemo(() => resolveLinkageEvaluators(evaluators), [evaluators]);
  const scope = useMemo<DataSourceParamScope | undefined>(
    () => values === null
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
