import type { EvaluationContext, LinkageEvaluators, LinkageScriptResult } from "../../types";

import { lru } from "@vef-framework-react/shared";

/**
 * Default evaluators used when the host project does not inject its own.
 * Conditions, assignment expressions, and script actions are all plain
 * JavaScript compiled through `new Function`: an expression as a single
 * expression evaluated for its value, a script as a statement block that may
 * `return` a state patch.
 *
 * The evaluation scope contains `field` / `$form` (the form values — `field` is
 * the legacy alias), `$vars` (form variables), `$user` / `$node` / `$applicant`
 * / `$globals` (host context), and `$now` (the current time as a `Date`). All
 * but `field` / `$form` / `$now` come from the optional
 * {@link EvaluationContext}.
 *
 * Security model: sources run in the host page through `new Function`, so the
 * framework assumes schemas come from a trusted source. Sandboxing remains the
 * host's responsibility — supply your own `LinkageEvaluators` to swap in a
 * sandboxed runtime.
 *
 * CSP behavior: the default evaluators require `'unsafe-eval'`. A blocked or
 * malformed source degrades to `false` for conditions and `undefined` for
 * assignment values and scripts.
 */

type Scope = Record<string, unknown>;

/**
 * One evaluation's bindings, in the order {@link SCOPE_PARAMS} names them.
 */
interface EvaluationBindings {
  form: Scope;
  vars: Scope;
  user: Scope;
  node: Scope;
  applicant: Scope;
  globals: Scope;
  now: Date;
}

type CompiledFn<T> = (bindings: EvaluationBindings) => T;

type ExpressionFn = CompiledFn<unknown>;

type ScriptFn = CompiledFn<LinkageScriptResult | void>;

// Sized for the package's 100s-of-fields target: a single schema can carry
// several hundred distinct expression/script sources, and every source is
// re-evaluated per keystroke — an undersized cache would evict-and-recompile
// (`new Function`) within one pass, every keystroke. Compiled closures are
// cheap to retain relative to recompilation.
const COMPILE_CACHE_SIZE = 500;
const EMPTY_SCOPE: Scope = Object.freeze({});

const expressionCache = lru<ExpressionFn>(COMPILE_CACHE_SIZE);
const scriptCache = lru<ScriptFn>(COMPILE_CACHE_SIZE);

// `field` and `$form` both bind the form values (`field` is the legacy alias);
// strict mode keeps `this === undefined` and disables sloppy-mode escape hatches.
const SCOPE_PARAMS = ["field", "$form", "$vars", "$user", "$node", "$applicant", "$globals", "$now"] as const;

/**
 * Bind a compiled `new Function` to {@link EvaluationBindings}, passing them
 * positionally in {@link SCOPE_PARAMS} order.
 */
function bindScope<T>(fn: (...args: unknown[]) => T): CompiledFn<T> {
  return bindings => fn(
    bindings.form,
    bindings.form,
    bindings.vars,
    bindings.user,
    bindings.node,
    bindings.applicant,
    bindings.globals,
    bindings.now
  );
}

function compileExpression(source: string): ExpressionFn {
  // A condition / assignment source is a single expression evaluated for its
  // value; wrapping it in `return (...)` rejects statement blocks. The newline
  // keeps a trailing line comment from swallowing the closing parenthesis.
  // eslint-disable-next-line no-new-func -- intentional: linkage expressions are trusted schema-supplied JavaScript; hosts that need a sandbox swap in their own LinkageEvaluators.
  return bindScope(new Function(...SCOPE_PARAMS, `"use strict"; return (${source}\n);`) as (...args: unknown[]) => unknown);
}

function compileScript(source: string): ScriptFn {
  // Action scripts are statement blocks — the user must `return { ... }`
  // explicitly if they want to patch state. No return is a valid no-op.
  // eslint-disable-next-line no-new-func -- intentional: script actions are trusted schema-supplied statement blocks; hosts that need a sandbox swap in their own LinkageEvaluators.
  return bindScope(new Function(...SCOPE_PARAMS, `"use strict"; ${source}`) as (...args: unknown[]) => LinkageScriptResult | void);
}

/**
 * Inert sentinel cached for sources that fail to compile (syntax errors,
 * CSP-blocked `new Function`). Returning `undefined` is lane-appropriate
 * everywhere: a condition folds it to `false`, an assignment to `undefined`,
 * a script action to "no state patch". Caching the failure means a broken
 * source throws once at compile, not on every keystroke-driven re-evaluation.
 */
function inertEvaluation(): undefined {
  // Intentionally empty: see doc comment.
}

function getCompiledExpression(source: string): ExpressionFn {
  let fn = expressionCache.get(source);

  if (!fn) {
    try {
      fn = compileExpression(source);
    } catch {
      fn = inertEvaluation;
    }

    expressionCache.set(source, fn);
  }

  return fn;
}

function getCompiledScript(source: string): ScriptFn {
  let fn = scriptCache.get(source);

  if (!fn) {
    try {
      fn = compileScript(source);
    } catch {
      fn = inertEvaluation;
    }

    scriptCache.set(source, fn);
  }

  return fn;
}

function runCompiled<T>(
  fn: CompiledFn<T>,
  values: Record<string, unknown>,
  context: EvaluationContext | undefined
): T {
  return fn({
    form: values,
    vars: context?.variables ?? EMPTY_SCOPE,
    user: context?.user ?? EMPTY_SCOPE,
    node: context?.node ?? EMPTY_SCOPE,
    applicant: context?.applicant ?? EMPTY_SCOPE,
    globals: context?.globals ?? EMPTY_SCOPE,
    now: new Date()
  });
}

export function defaultEvaluateExpression(
  source: string,
  values: Record<string, unknown>,
  context?: EvaluationContext
): boolean {
  try {
    return runCompiled(getCompiledExpression(source), values, context) === true;
  } catch {
    // Swallow runtime errors (e.g. member access on undefined) — the
    // condition simply doesn't match.
    return false;
  }
}

export function defaultEvaluateAssignExpression(
  source: string,
  values: Record<string, unknown>,
  context?: EvaluationContext
): unknown {
  try {
    return runCompiled(getCompiledExpression(source), values, context);
  } catch {
    return undefined;
  }
}

export function defaultEvaluateScriptAction(
  source: string,
  values: Record<string, unknown>,
  context?: EvaluationContext
): LinkageScriptResult | void {
  try {
    return runCompiled(getCompiledScript(source), values, context);
  } catch {
    // Swallow runtime errors — a broken script must not crash the form.
    return undefined;
  }
}

/**
 * No-op effect dispatcher used when the host wires none. Host-delegated effect
 * actions (`alert` / `api_call` / `navigate`) become benign no-ops — exactly as
 * a `remote` data source resolves to an empty list without a resolver.
 */
function noopDispatchEffect(): void {
  // Intentionally empty: see doc comment.
}

/**
 * Resolves a host-supplied {@link LinkageEvaluators} to a fully populated set,
 * filling missing expression and script slots with the default `new Function`
 * evaluators and effects with the no-op dispatcher.
 */
export function resolveLinkageEvaluators(overrides?: LinkageEvaluators): Required<LinkageEvaluators> {
  return {
    evaluateExpression: overrides?.evaluateExpression ?? defaultEvaluateExpression,
    evaluateScriptAction: overrides?.evaluateScriptAction ?? defaultEvaluateScriptAction,
    evaluateAssignExpression: overrides?.evaluateAssignExpression ?? defaultEvaluateAssignExpression,
    dispatchEffect: overrides?.dispatchEffect ?? noopDispatchEffect
  };
}
