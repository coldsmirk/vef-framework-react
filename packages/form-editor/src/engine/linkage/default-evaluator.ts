import type { ExpressionContext, LinkageEvaluators, LinkageScriptResult } from "../../types";

import { lru } from "@vef-framework-react/shared";

/**
 * Default JS evaluators used when the host project does not inject its
 * own. Both forms compile `source` with `new Function` once and cache the
 * compiled function, so repeated evaluations during a form session are
 * just function calls.
 *
 * The compiled function receives the full scope: `field` / `$form` (the form
 * values — `field` is the legacy alias), `$vars` (form variables), `$user` /
 * `$node` (host context), and `$now` (the current time). All but `field` /
 * `$form` come from the optional {@link ExpressionContext}.
 *
 * Security model: the framework assumes form schemas come from a trusted
 * source (your own backend or design-time editor). `new Function` runs
 * inside the same realm as the host page; sandboxing is the host's
 * responsibility if untrusted schemas are involved — supply your own
 * `LinkageEvaluators` to swap in a sandboxed runtime.
 *
 * CSP behavior: `new Function` requires the page to allow `'unsafe-eval'`.
 * Under a stricter Content-Security-Policy the constructor throws at compile
 * time; that failure is cached like a successful compile (as an inert
 * function), so expression conditions degrade to `false`, assign / script
 * expressions to `undefined`, and the form keeps rendering without re-throwing
 * per evaluation. Hosts running under such a policy should supply ZEN-backed
 * `LinkageEvaluators` (see `@vef-framework-react/expression`) instead of
 * relying on these defaults.
 */

type Scope = Record<string, unknown>;

type ExpressionFn = ($form: Scope, $vars: Scope, $user: Scope, $node: Scope, $now: Date) => unknown;

type ScriptFn = ($form: Scope, $vars: Scope, $user: Scope, $node: Scope, $now: Date) => LinkageScriptResult | void;

const COMPILE_CACHE_SIZE = 100;
const EMPTY_SCOPE: Scope = Object.freeze({});

const expressionCache = lru<ExpressionFn>(COMPILE_CACHE_SIZE);
const scriptCache = lru<ScriptFn>(COMPILE_CACHE_SIZE);

// `field` and `$form` both bind the form values (`field` is the legacy alias);
// strict mode keeps `this === undefined` and disables sloppy-mode escape hatches.
const SCOPE_PARAMS = ["field", "$form", "$vars", "$user", "$node", "$now"] as const;

function compileExpression(source: string): ExpressionFn {
  // The body is wrapped in `return (...)` so callers write a bare expression.
  // eslint-disable-next-line no-new-func -- intentional: the default JS evaluator runs trusted schema-supplied expressions; hosts that need a sandbox swap in their own LinkageEvaluators.
  const fn = new Function(...SCOPE_PARAMS, `"use strict"; return (${source});`);

  return (($form, $vars, $user, $node, $now) => fn($form, $form, $vars, $user, $node, $now)) as ExpressionFn;
}

function compileScript(source: string): ScriptFn {
  // Action scripts are statement blocks — the user must `return { ... }`
  // explicitly if they want to patch state. No return is a valid no-op.
  // eslint-disable-next-line no-new-func -- intentional: see compileExpression above.
  const fn = new Function(...SCOPE_PARAMS, `"use strict"; ${source}`);

  return (($form, $vars, $user, $node, $now) => fn($form, $form, $vars, $user, $node, $now)) as ScriptFn;
}

/**
 * Inert sentinel cached for sources that fail to compile (syntax errors,
 * CSP-blocked `new Function`). Returning `undefined` is lane-appropriate for
 * every caller: a condition coerces it to `false`, assign / script lanes treat
 * it as "no value / no patch". Caching the failure means a broken expression
 * throws once at compile, not on every keystroke-driven re-evaluation.
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
  fn: ($form: Scope, $vars: Scope, $user: Scope, $node: Scope, $now: Date) => T,
  values: Record<string, unknown>,
  context: ExpressionContext | undefined
): T {
  return fn(
    values,
    context?.variables ?? EMPTY_SCOPE,
    context?.user ?? EMPTY_SCOPE,
    context?.node ?? EMPTY_SCOPE,
    new Date()
  );
}

export function defaultEvaluateExpression(
  source: string,
  values: Record<string, unknown>,
  context?: ExpressionContext
): boolean {
  try {
    return Boolean(runCompiled(getCompiledExpression(source), values, context));
  } catch {
    return false;
  }
}

export function defaultEvaluateAssignExpression(
  source: string,
  values: Record<string, unknown>,
  context?: ExpressionContext
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
  context?: ExpressionContext
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
 * filling missing slots with the default `new Function` evaluators and the
 * no-op effect dispatcher.
 */
export function resolveLinkageEvaluators(overrides?: LinkageEvaluators): Required<LinkageEvaluators> {
  return {
    evaluateExpression: overrides?.evaluateExpression ?? defaultEvaluateExpression,
    evaluateScriptAction: overrides?.evaluateScriptAction ?? defaultEvaluateScriptAction,
    evaluateAssignExpression: overrides?.evaluateAssignExpression ?? defaultEvaluateAssignExpression,
    dispatchEffect: overrides?.dispatchEffect ?? noopDispatchEffect
  };
}
