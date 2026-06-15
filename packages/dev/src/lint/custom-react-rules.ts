/* eslint-disable unicorn/consistent-function-scoping -- kit rule factories require nested function returns */
import type { RuleFunction } from "@eslint-react/kit";
import type { Linter, Rule } from "eslint";

import eslintReactKit from "@eslint-react/kit";

// ============================================================================
// Rules using @eslint-react/kit
// ============================================================================

// Enforce `<Comp disabled />` instead of `<Comp disabled={true} />`
function jsxShorthandBoolean(): RuleFunction {
  return context => {
    return {
      JSXAttribute(node: any) {
        const { value } = node;

        if (
          value?.type === "JSXExpressionContainer"
          && value.expression?.type === "Literal"
          && value.expression.value === true
        ) {
          context.report({
            fix: fixer => fixer.removeRange([node.name.range[1], value.range[1]]),
            message: "Use shorthand boolean attribute instead of `={true}`.",
            node
          });
        }
      }
    };
  };
}

// Enforce `<>...</>` instead of `<Fragment>...</Fragment>` when no key is needed
function jsxShorthandFragment(): RuleFunction {
  return context => {
    return {
      JSXElement(node: any) {
        const opening = node.openingElement;

        if (!opening) {
          return;
        }

        const { name } = opening;
        const isFragment
          = (name.type === "JSXIdentifier" && name.name === "Fragment")
            || (name.type === "JSXMemberExpression" && name.object?.name === "React" && name.property?.name === "Fragment");

        if (isFragment && opening.attributes.length === 0) {
          context.report({ message: "Use shorthand `<>...</>` instead of `<Fragment>...</Fragment>`.", node });
        }
      }
    };
  };
}

// Enforce "medium" as the canonical size token across size / componentSize /
// gap props. The framework's Size type already excludes "middle", but
// Stack / Group / Flex expose `gap` via LiteralUnion which widens to `string`,
// letting the legacy literal slip past the type checker. Walks past type-only
// wrappers (`as`, `satisfies`, angle-bracket assertions, `!`) so cast forms
// are caught, and accepts no-interpolation template strings.
function noLegacyMiddleSize(): RuleFunction {
  const TARGET_PROPS = new Set(["size", "componentSize", "gap"]);

  function findMiddle(node: any): any | null {
    if (!node) {
      return null;
    }

    if (
      node.type === "TSAsExpression"
      || node.type === "TSSatisfiesExpression"
      || node.type === "TSTypeAssertion"
      || node.type === "TSNonNullExpression"
    ) {
      return findMiddle(node.expression);
    }

    if (node.type === "Literal") {
      return node.value === "middle" ? node : null;
    }

    if (node.type === "TemplateLiteral") {
      return node.expressions.length === 0
        && node.quasis.length === 1
        && node.quasis[0].value.cooked === "middle"
        ? node
        : null;
    }

    return null;
  }

  return context => {
    function reportMiddle(target: any, propLabel: string) {
      context.report({
        fix: fixer => fixer.replaceText(target, "\"medium\""),
        message: `Use "medium" instead of "middle" for \`${propLabel}\`.`,
        node: target
      });
    }

    return {
      JSXAttribute(node: any) {
        const propName = node.name?.name;

        if (typeof propName !== "string" || !TARGET_PROPS.has(propName)) {
          return;
        }

        const inner = node.value?.type === "JSXExpressionContainer"
          ? node.value.expression
          : node.value;
        const target = findMiddle(inner);

        if (target) {
          reportMiddle(target, propName);
        }
      },
      Property(node: any) {
        if (node.computed) {
          return;
        }

        const keyName
          = node.key?.type === "Identifier"
            ? node.key.name
            : node.key?.type === "Literal" && typeof node.key.value === "string"
              ? node.key.value
              : null;

        if (typeof keyName !== "string" || !TARGET_PROPS.has(keyName)) {
          return;
        }

        const target = findMiddle(node.value);

        if (target) {
          reportMiddle(target, keyName);
        }
      }
    };
  };
}

// Disallow `${...}` in JSX text (likely a template literal mistake).
// JSX parses `Hello ${name}` as JSXText("Hello $") + JSXExpressionContainer({name}).
// Detect a `$` at the end of JSXText immediately followed by a JSXExpressionContainer.
function jsxNoDollarInterpolation(): RuleFunction {
  return context => {
    return {
      JSXText(node: any) {
        if (!node.value.endsWith("$")) {
          return;
        }

        const { parent } = node;

        if (!parent?.children) {
          return;
        }

        const idx = parent.children.indexOf(node);
        const next = parent.children[idx + 1];

        if (next?.type === "JSXExpressionContainer") {
        // eslint-disable-next-line no-template-curly-in-string
          context.report({ message: "Unexpected `$` before JSX expression. Use `{...}` instead of `${...}`.", node });
        }
      }
    };
  };
}

export const kitConfig: Linter.Config = eslintReactKit()
  .use(jsxShorthandBoolean)
  .use(jsxShorthandFragment)
  .use(jsxNoDollarInterpolation)
  .use(noLegacyMiddleSize)
  .getConfig();

// ============================================================================
// Traditional rules (requires schema/options not supported by kit)
// ============================================================================

/**
 * Vendored from eslint-plugin-react@7.37.5 and trimmed to the behavior we use.
 *
 * Original rule: react/jsx-no-duplicate-props
 */

interface JSXIdentifierNode {
  name: string;
  type: "JSXIdentifier";
}

interface JSXAttributeNode {
  name: JSXIdentifierNode;
  type: "JSXAttribute";
}

interface JSXSpreadAttributeNode {
  type: "JSXSpreadAttribute";
}

interface JSXOpeningElementNode {
  attributes: Array<JSXAttributeNode | JSXSpreadAttributeNode>;
  type: "JSXOpeningElement";
}

interface JSXNoDuplicatePropsOptions {
  ignoreCase?: boolean;
}

function isJsxOpeningElementNode(node: unknown): node is JSXOpeningElementNode {
  return node !== null && typeof node === "object" && "type" in node && (node as { type?: string }).type === "JSXOpeningElement";
}

const jsxNoDuplicatePropsRule = {
  create(context: Rule.RuleContext) {
    const configuration = (context.options[0] ?? {}) as JSXNoDuplicatePropsOptions;
    const ignoreCase = configuration.ignoreCase ?? false;

    return {
      JSXOpeningElement(node: unknown) {
        if (!isJsxOpeningElementNode(node)) {
          return;
        }

        const props: Record<string, true> = {};

        for (const declaration of node.attributes) {
          if (declaration.type === "JSXSpreadAttribute") {
            continue;
          }

          let { name } = declaration.name;

          if (typeof name !== "string") {
            continue;
          }

          if (ignoreCase) {
            name = name.toLowerCase();
          }

          if (Object.hasOwn(props, name)) {
            context.report({
              messageId: "noDuplicateProps",
              node: declaration as never
            });
            continue;
          }

          props[name] = true;
        }
      }
    };
  },
  meta: {
    docs: {
      description: "Disallow duplicate properties in JSX."
    },
    messages: {
      noDuplicateProps: "No duplicate props allowed."
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          ignoreCase: {
            type: "boolean"
          }
        },
        type: "object"
      }
    ],
    type: "problem"
  }
} satisfies Rule.RuleModule;

export const localReactPlugin = {
  rules: {
    "jsx-no-duplicate-props": jsxNoDuplicatePropsRule
  }
};

export const localReactRules: Linter.RulesRecord = {
  "local-react/jsx-no-duplicate-props": "error"
};
