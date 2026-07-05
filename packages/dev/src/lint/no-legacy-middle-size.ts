import type { Rule } from "eslint";

/**
 * Props whose value must use the canonical "medium" size token, never the legacy "middle".
 */
const TARGET_PROPS = new Set(["size", "componentSize", "gap"]);

// Type-only expression wrappers to see through when resolving a value to its underlying literal.
const TYPE_ONLY_WRAPPERS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSTypeAssertion", "TSNonNullExpression"]);

/**
 * Walk past type-only wrappers (`as`, `satisfies`, angle-bracket assertion, `!`) and return the
 * offending "middle" node — a bare string literal or a no-interpolation template — or null.
 */
function findMiddle(input: any): any {
  let node = input;

  while (node && TYPE_ONLY_WRAPPERS.has(node.type)) {
    node = node.expression;
  }

  if (!node) {
    return null;
  }

  if (node.type === "Literal") {
    return node.value === "middle" ? node : null;
  }

  if (node.type === "TemplateLiteral") {
    return node.expressions.length === 0 && node.quasis.length === 1 && node.quasis[0].value.cooked === "middle"
      ? node
      : null;
  }

  return null;
}

/**
 * Enforce "medium" as the canonical size token across `size` / `componentSize` / `gap`. The
 * framework's Size type already excludes "middle", but Stack / Group / Flex expose `gap` via a
 * LiteralUnion that widens to `string`, letting the legacy literal slip past the type checker. This
 * is specific to the framework's design tokens, so it is layered on top of canon as a local plugin
 * rather than belonging in the shared config.
 */
const noLegacyMiddleSize: Rule.RuleModule = {
  create(context) {
    function report(target: any, prop: string): void {
      context.report({
        node: target,
        messageId: "useMedium",
        data: { prop },
        fix: fixer => fixer.replaceText(target, "\"medium\"")
      });
    }

    return {
      JSXAttribute(node: any) {
        const prop = node.name?.name;

        if (typeof prop !== "string" || !TARGET_PROPS.has(prop)) {
          return;
        }

        const inner = node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        const target = findMiddle(inner);

        if (target) {
          report(target, prop);
        }
      },
      Property(node: any) {
        if (node.computed) {
          return;
        }

        const key = node.key?.type === "Identifier"
          ? node.key.name
          : node.key?.type === "Literal" && typeof node.key.value === "string"
            ? node.key.value
            : null;

        if (typeof key !== "string" || !TARGET_PROPS.has(key)) {
          return;
        }

        const target = findMiddle(node.value);

        if (target) {
          report(target, key);
        }
      }
    };
  },
  meta: {
    type: "problem",
    docs: {
      description: "Enforce \"medium\" instead of the legacy \"middle\" size token."
    },
    fixable: "code",
    messages: {
      useMedium: "Use \"medium\" instead of \"middle\" for `{{prop}}`."
    },
    schema: []
  }
};

/**
 * Local ESLint plugin carrying the framework's project-specific rules, layered after canon's sealed
 * config by the dev `defineEslintConfig`.
 */
export const localPlugin = {
  rules: {
    "no-legacy-middle-size": noLegacyMiddleSize
  }
};
