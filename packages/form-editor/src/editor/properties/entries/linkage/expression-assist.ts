import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";

import type { SourceFieldOption } from "./options";

import { autocompletion } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { linter } from "@codemirror/lint";

/**
 * Editor assistance for the JS linkage expressions (`field.x > 1`-style
 * conditions and script sources): scope-aware autocompletion plus a lint pass
 * that flags member access on keys the current scope does not provide.
 * Everything here is pure CodeMirror extension wiring — the evaluator
 * (`engine/linkage/default-evaluator.ts`) stays the single source of truth
 * for what the scope actually contains at runtime.
 */

/**
 * Mirrors the evaluator's `SCOPE_PARAMS` — `field` and `$form` alias the form values.
 */
const VALUE_ROOTS = new Set(["field", "$form"]);

const ROOT_COMPLETIONS: Completion[] = [
  {
    label: "field",
    type: "variable",
    detail: "表单字段值（field.字段Key）"
  },
  {
    label: "$form",
    type: "variable",
    detail: "表单字段值（field 的别名）"
  },
  {
    label: "$vars",
    type: "variable",
    detail: "表单变量"
  },
  {
    label: "$user",
    type: "variable",
    detail: "宿主用户上下文"
  },
  {
    label: "$node",
    type: "variable",
    detail: "宿主节点上下文"
  },
  {
    label: "$now",
    type: "variable",
    detail: "当前时间"
  }
];

export interface ExpressionAssistArgs {
  /**
   * Keyed fields reachable from the rule's value scope.
   */
  fields: SourceFieldOption[];
  /**
   * Declared form-variable names (completion only — hosts may inject more).
   */
  variables: string[];
}

/**
 * Completion source: after `field.` / `$form.` offer the scope's field keys
 * (labels as detail), after `$vars.` the declared variables, and at a bare
 * word the scope roots themselves.
 */
export function buildCompletionSource(args: ExpressionAssistArgs): (context: CompletionContext) => CompletionResult | null {
  const fieldCompletions: Completion[] = args.fields.map(field => {
    return {
      label: field.value,
      type: "property",
      detail: field.label
    };
  });
  const variableCompletions: Completion[] = args.variables.map(name => {
    return {
      label: name,
      type: "property"
    };
  });

  return context => {
    const member = context.matchBefore(/(?:\$vars|\$form|field)\.[\w$]*/);

    if (member) {
      const dot = member.text.indexOf(".");
      const root = member.text.slice(0, dot);
      const options = root === "$vars" ? variableCompletions : fieldCompletions;

      if (options.length === 0) {
        return null;
      }

      return {
        from: member.from + dot + 1,
        options,
        validFor: /^[\w$]*$/
      };
    }

    const word = context.matchBefore(/[\w$]+/);

    if (!word && !context.explicit) {
      return null;
    }

    return {
      from: word?.from ?? context.pos,
      options: ROOT_COMPLETIONS,
      validFor: /^[\w$]*$/
    };
  };
}

/**
 * Lint pass over the parsed tree: `field.x` / `$form.x` where `x` is not a
 * key in the rule's scope gets a warning — the most common silent failure in
 * hand-written expressions is a misspelled key that simply never matches.
 * `$vars` / `$user` / `$node` are deliberately NOT linted: hosts inject
 * members the schema cannot know about.
 */
export function lintUnknownFieldMembers(view: EditorView, fieldKeys: ReadonlySet<string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (fieldKeys.size === 0) {
    return diagnostics;
  }

  syntaxTree(view.state).iterate({
    enter: node => {
      if (node.name !== "MemberExpression") {
        return;
      }

      const objectNode = node.node.firstChild;
      const propNode = node.node.lastChild;

      if (objectNode?.name !== "VariableName" || propNode?.name !== "PropertyName") {
        return;
      }

      const root = view.state.sliceDoc(objectNode.from, objectNode.to);

      if (!VALUE_ROOTS.has(root)) {
        return;
      }

      const prop = view.state.sliceDoc(propNode.from, propNode.to);

      if (!fieldKeys.has(prop)) {
        diagnostics.push({
          from: propNode.from,
          to: propNode.to,
          severity: "warning",
          message: `当前作用域内没有字段 key「${prop}」`
        });
      }
    }
  });

  return diagnostics;
}

/**
 * The complete extension set for a linkage expression / script editor.
 */
export function expressionAssistExtensions(args: ExpressionAssistArgs) {
  const fieldKeys: ReadonlySet<string> = new Set(args.fields.map(field => field.value));

  return [
    autocompletion({ override: [buildCompletionSource(args)] }),
    linter(view => lintUnknownFieldMembers(view, fieldKeys), { delay: 300 })
  ];
}
