import type { EvaluationContext } from "../../types";

import { assertNever } from "../assert-never";
import { isRecord } from "../validation";

/**
 * The evaluation-context slot each context root reads — together with `$form`
 * (the form values, which are not part of the context) the complete set of
 * roots a `$`-rooted scope path may start with. The leaf-condition resolver,
 * the validator, and the designer all read this one table, so a root missing
 * here resolves nowhere and is reported instead of silently never matching.
 */
const CONTEXT_SLOTS = {
  $vars: "variables",
  $user: "user",
  $node: "node",
  $applicant: "applicant",
  $globals: "globals"
} as const satisfies Record<string, keyof EvaluationContext>;

export type ContextScopeRoot = keyof typeof CONTEXT_SLOTS;

function isContextScopeRoot(value: string): value is ContextScopeRoot {
  return Object.hasOwn(CONTEXT_SLOTS, value);
}

/**
 * Where a leaf condition's `sourceKey` or a reference `DynamicValue`'s `path`
 * reads from.
 *
 * - `form` — a form value of the rule's own value scope: a plain key
 * (`amount`) or its explicit spelling `$form.amount`. `key` is the binding the
 * value lives under, which is what dependency tracking, validation, and key
 * renames address; `path` walks into that value.
 * - `context` — a slot of the evaluation context (`$applicant.departmentId`).
 * Its changes arrive through the context, never through a form key.
 * - `step` — an earlier step's output inside an action sequence
 * (`$steps.record.name`). Valid only inside effect actions, never in
 * conditions, guards, state actions, or option-source params.
 * - `unknown` — a `$` root no scope slot answers to, or a bare `$form` /
 * `$steps` with no key/step name. It can never resolve.
 */
export type LeafSource
  = | { kind: "form"; key: string; path: string[] }
    | { kind: "context"; root: ContextScopeRoot; path: string[] }
    | { kind: "step"; step: string; path: string[] }
    | { kind: "unknown" };

/**
 * Parse a leaf `sourceKey` or reference `path` into the scope slot it reads.
 * Field keys never contain a dot (the key charset is letters, digits, and
 * underscores), so a dotted source is always a `$`-rooted path.
 */
export function parseLeafSource(sourceKey: string): LeafSource {
  if (!sourceKey.startsWith("$")) {
    return {
      kind: "form",
      key: sourceKey,
      path: []
    };
  }

  const [root = "", ...path] = sourceKey.split(".");

  if (isContextScopeRoot(root)) {
    return {
      kind: "context",
      root,
      path
    };
  }

  const [head, ...rest] = path;

  if (root === "$form") {
    return head === undefined || head.length === 0
      ? { kind: "unknown" }
      : {
          kind: "form",
          key: head,
          path: rest
        };
  }

  if (root === "$steps") {
    return head === undefined || head.length === 0
      ? { kind: "unknown" }
      : {
          kind: "step",
          step: head,
          path: rest
        };
  }

  return { kind: "unknown" };
}

/**
 * The form key a scope path depends on, or `undefined` when it reads context,
 * a step output, or nothing at all.
 */
export function leafSourceFormKey(sourceKey: string): string | undefined {
  const source = parseLeafSource(sourceKey);

  return source.kind === "form" ? source.key : undefined;
}

/**
 * Rewrite the form key a scope path depends on, keeping its spelling: a plain
 * key becomes `nextKey`, `$form.old.x` becomes `$form.next.x`. Context and
 * step paths are returned untouched.
 */
export function withLeafSourceFormKey(sourceKey: string, nextKey: string): string {
  const source = parseLeafSource(sourceKey);

  if (source.kind !== "form") {
    return sourceKey;
  }

  return sourceKey.startsWith("$") ? ["$form", nextKey, ...source.path].join(".") : nextKey;
}

/**
 * Rewrite a `$vars.<name>...` scope path when form variable `name` is renamed
 * to `nextName`, preserving any trailing property segments. Non-matching paths
 * are returned untouched.
 */
export function withLeafSourceVariableName(sourceKey: string, name: string, nextName: string): string {
  const source = parseLeafSource(sourceKey);

  if (source.kind !== "context" || source.root !== "$vars" || source.path[0] !== name) {
    return sourceKey;
  }

  return ["$vars", nextName, ...source.path.slice(1)].join(".");
}

/**
 * Read `key` off `value` only when it is an own property. A prototype member
 * (`constructor`, `toString`, …) is never data: reading it would hand a
 * function to an operator and make `notEmpty` true forever.
 */
export function readOwnProperty(value: unknown, key: string): unknown {
  return isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined;
}

/**
 * Walk a dotted or segmented own-property path into `value`. Any prototype
 * member or broken segment degrades to `undefined`.
 */
export function walkOwnPath(value: unknown, path: readonly string[]): unknown {
  let current = value;

  for (const segment of path) {
    current = readOwnProperty(current, segment);

    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

/**
 * Resolve a scope path to its runtime value: a form value of the scope's
 * `values`, a path into the evaluation context, or (when `options.allowSteps`
 * is true) an earlier step's output in `context.steps`. Every segment is read
 * as an own property, and an unknown root or broken path resolves to
 * `undefined`.
 */
export function resolveLeafSourceValue(
  sourceKey: string,
  values: Record<string, unknown>,
  context: EvaluationContext | undefined,
  options?: { allowSteps?: boolean }
): unknown {
  const source = parseLeafSource(sourceKey);

  switch (source.kind) {
    case "form": {
      return walkOwnPath(readOwnProperty(values, source.key), source.path);
    }

    case "context": {
      return walkOwnPath(context?.[CONTEXT_SLOTS[source.root]], source.path);
    }

    case "step": {
      if (options?.allowSteps !== true) {
        return undefined;
      }

      return walkOwnPath(readOwnProperty(context?.steps, source.step), source.path);
    }

    case "unknown": {
      return undefined;
    }

    default: {
      return assertNever(source);
    }
  }
}

function withPathValue(target: unknown, path: readonly string[], value: unknown): Record<string, unknown> {
  const [head, ...rest] = path;
  const base = isRecord(target) ? target : {};

  if (head === undefined) {
    return base;
  }

  return {
    ...base,
    [head]: rest.length === 0 ? value : withPathValue(base[head], rest, value)
  };
}

/**
 * Lay values over an evaluation context by scope path (`$applicant.name` →
 * `context.applicant.name`), copying only the slots they touch. A path that
 * names no context member — a form value, an unknown root, a bare root — is
 * skipped: form values come from the form itself. Returns `context` itself
 * when nothing applies, so a memoized caller keeps its identity.
 */
export function withContextValues(
  context: EvaluationContext | undefined,
  values: ReadonlyMap<string, unknown>
): EvaluationContext | undefined {
  let next = context;

  for (const [path, value] of values) {
    const source = parseLeafSource(path);

    if (source.kind !== "context" || source.path.length === 0) {
      continue;
    }

    const slot = CONTEXT_SLOTS[source.root];

    next = { ...next, [slot]: withPathValue(next?.[slot], source.path, value) };
  }

  return next;
}
