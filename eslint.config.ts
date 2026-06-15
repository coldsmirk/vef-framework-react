import type { Linter } from "eslint";

import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import react from "@eslint-react/eslint-plugin";
import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import gitignore from "eslint-config-flat-gitignore";
import antfu from "eslint-plugin-antfu";
import format from "eslint-plugin-format";
import importLite from "eslint-plugin-import-lite";
import jestDom from "eslint-plugin-jest-dom";
import jsdoc from "eslint-plugin-jsdoc";
import perfectionist from "eslint-plugin-perfectionist";
import reactDom from "eslint-plugin-react-dom";
import reactHooks from "eslint-plugin-react-hooks";
import reactJsx from "eslint-plugin-react-jsx";
import reactNamingConvention from "eslint-plugin-react-naming-convention";
import reactWebApi from "eslint-plugin-react-web-api";
import regex from "eslint-plugin-regexp";
import testingLibrary from "eslint-plugin-testing-library";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig } from "eslint/config";
import tslint from "typescript-eslint";

import { kitConfig, localReactPlugin, localReactRules } from "./packages/dev/src/lint/custom-react-rules";

// ============================================================================
// Prettier Configuration
// ============================================================================

const prettierOptions = {
  arrowParens: "avoid",
  bracketSameLine: false,
  bracketSpacing: true,
  endOfLine: "lf",
  htmlWhitespaceSensitivity: "strict",
  jsxSingleQuote: false,
  objectWrap: "preserve",
  printWidth: 120,
  proseWrap: "never",
  quoteProps: "as-needed",
  semi: true,
  singleAttributePerLine: false,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "none",
  useTabs: false
};

// ============================================================================
// Rule Definitions
// ============================================================================

// Rules: https://eslint.org/docs/latest/rules/
const javascriptRules: Linter.RulesRecord = {
  "accessor-pairs": ["error", { enforceForClassMembers: true, setWithoutGet: true }],
  "array-callback-return": ["error", { allowImplicit: true }],
  "arrow-body-style": ["error", "as-needed", { requireReturnForObjectLiteral: true }],
  "block-scoped-var": "error",
  // Superseded by `@typescript-eslint/naming-convention` which understands TS-specific
  // contexts (interface members, type aliases, enums) that this rule cannot reach.
  camelcase: "off",
  curly: ["error", "all"],
  "default-case-last": "error",
  "dot-notation": ["error", { allowKeywords: true }],
  eqeqeq: ["error", "smart"],
  "func-style": ["error", "declaration", { allowArrowFunctions: true }],
  "new-cap": [
    "error",
    {
      capIsNew: false,
      newIsCap: true,
      properties: true
    }
  ],
  "no-alert": "error",
  "no-caller": "error",
  "no-cond-assign": ["error", "always"],
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-eq-null": "error",
  "no-eval": "error",
  "no-extend-native": "error",
  "no-extra-bind": "error",
  "no-extra-label": "error",
  "no-implied-eval": "error",
  "no-invalid-this": "error",
  "no-iterator": "error",
  "no-labels": ["error", { allowLoop: false, allowSwitch: false }],
  "no-lone-blocks": "error",
  "no-multi-str": "error",
  "no-new": "error",
  "no-new-func": "error",
  "no-new-wrappers": "error",
  "no-obj-calls": "error",
  "no-octal-escape": "error",
  "no-promise-executor-return": ["error", { allowVoid: true }],
  "no-proto": "error",
  "no-restricted-globals": [
    "error",
    { message: "Use `globalThis` instead.", name: "global" },
    { message: "Use `globalThis` instead.", name: "self" }
  ],
  "no-restricted-properties": [
    "error",
    { message: "Use `Object.getPrototypeOf` or `Object.setPrototypeOf` instead.", property: "__proto__" },
    { message: "Use `Object.defineProperty` instead.", property: "__defineGetter__" },
    { message: "Use `Object.defineProperty` instead.", property: "__defineSetter__" },
    { message: "Use `Object.getOwnPropertyDescriptor` instead.", property: "__lookupGetter__" },
    { message: "Use `Object.getOwnPropertyDescriptor` instead.", property: "__lookupSetter__" }
  ],
  "no-restricted-syntax": [
    "error",
    "TSEnumDeclaration[const=true]",
    "TSExportAssignment",
    { selector: "JSXAttribute[name.name='ref'][value.type='Literal']", message: "Use callback refs or useRef instead of string refs." },
    { selector: "JSXAttribute[name.name='ref'] > JSXExpressionContainer > Literal", message: "Use callback refs or useRef instead of string refs." },
    { selector: "JSXAttribute[name.name='ref'] > JSXExpressionContainer > TemplateLiteral", message: "Use callback refs or useRef instead of string refs." }
  ],
  "no-self-compare": "error",
  "no-sequences": "error",
  "no-template-curly-in-string": "error",
  "no-throw-literal": "error",
  "no-undef-init": "error",
  "no-unmodified-loop-condition": "error",
  "no-unneeded-ternary": ["error", { defaultAssignment: false }],
  "no-unreachable": "error",
  "no-unreachable-loop": "error",
  "no-unused-vars": "off",
  "no-useless-call": "error",
  "no-useless-computed-key": "error",
  "no-useless-concat": "error",
  "no-useless-rename": "error",
  "no-useless-return": "error",
  "object-shorthand": ["error", "always", { avoidQuotes: true, ignoreConstructors: false }],
  "one-var": ["error", { initialized: "never" }],
  "prefer-arrow-callback": ["error", { allowNamedFunctions: false, allowUnboundThis: true }],
  "prefer-const": ["error", { destructuring: "all", ignoreReadBeforeAssign: true }],
  "prefer-destructuring": "error",
  "prefer-exponentiation-operator": "error",
  "prefer-named-capture-group": "error",
  "prefer-numeric-literals": "error",
  "prefer-object-has-own": "error",
  "prefer-object-spread": "error",
  "prefer-promise-reject-errors": "error",
  "prefer-regex-literals": ["error", { disallowRedundantWrapping: true }],
  "prefer-template": "error",
  "require-atomic-updates": "error",
  "require-await": "error",
  "symbol-description": "error",
  "unicode-bom": ["error", "never"],
  "use-isnan": ["error", { enforceForIndexOf: true, enforceForSwitchCase: true }],
  "valid-typeof": ["error", { requireStringLiterals: true }],
  yoda: ["error", "never"]
};

// Rules: https://typescript-eslint.io/rules/
const typescriptRules: Linter.RulesRecord = {
  "@typescript-eslint/array-type": ["error", { default: "array-simple", readonly: "array-simple" }],
  "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "as", objectLiteralTypeAssertions: "allow" }],
  "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
  "@typescript-eslint/max-params": ["error", { max: 5 }],
  "@typescript-eslint/method-signature-style": ["error", "property"],
  "@typescript-eslint/naming-convention": [
    "error",
    {
      selector: "default",
      format: ["camelCase"],
      leadingUnderscore: "forbid",
      trailingUnderscore: "forbid"
    },
    {
      selector: "variable",
      format: ["camelCase", "UPPER_CASE", "PascalCase"],
      leadingUnderscore: "forbid",
      trailingUnderscore: "forbid"
    },
    {
      selector: "function",
      format: ["camelCase", "PascalCase"],
      leadingUnderscore: "forbid",
      trailingUnderscore: "forbid"
    },
    // Parameters may carry a leading underscore to flag an intentionally unused argument
    // (e.g. `(_event, value) => ...`). PascalCase is allowed because parameters often
    // hold React component references (e.g. `withFormItem(name, PureField)`), where
    // JSX semantics require the PascalCase casing.
    {
      selector: "parameter",
      format: ["camelCase", "PascalCase"],
      leadingUnderscore: "allow",
      trailingUnderscore: "forbid"
    },
    {
      selector: "typeLike",
      format: ["PascalCase"],
      leadingUnderscore: "forbid",
      trailingUnderscore: "forbid"
    },
    // Enum members: PascalCase per the modern TS community convention
    // (TypeScript compiler, Google TS Style Guide, VS Code, antd, TanStack).
    {
      selector: "enumMember",
      format: ["PascalCase"],
      leadingUnderscore: "forbid",
      trailingUnderscore: "forbid"
    },
    // Third-party imports may use any casing.
    { selector: "import", format: null },
    // Property keys frequently mirror external contracts (React component identities,
    // antd ComponentToken, ESLint AST node names, HTTP headers, CSS vendor prefixes,
    // backend snake_case wire format) rather than being developer-chosen identifiers.
    // Allow the three formats that legitimately appear in those contexts; UPPER_CASE
    // is intentionally excluded — module constants belong at file scope, not inside
    // a namespace object, and enum-shaped dictionaries should use a real enum.
    {
      selector: ["objectLiteralProperty", "typeProperty", "classProperty"],
      format: ["camelCase", "PascalCase", "snake_case"],
      leadingUnderscore: "forbid",
      trailingUnderscore: "forbid"
    },
    {
      selector: ["objectLiteralMethod", "typeMethod", "classMethod"],
      format: ["camelCase", "PascalCase"],
      leadingUnderscore: "forbid",
      trailingUnderscore: "forbid"
    },
    // Names that genuinely require quotes (e.g. "Content-Type", "X-API-Key") are
    // exempt from format checks — they are wire literals, not identifiers.
    {
      selector: ["objectLiteralProperty", "typeProperty", "classProperty"],
      format: null,
      modifiers: ["requiresQuotes"]
    }
  ],
  "@typescript-eslint/no-dynamic-delete": "off",
  "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "always" }],
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-import-type-side-effects": "error",
  "@typescript-eslint/no-invalid-void-type": "off",
  "@typescript-eslint/no-non-null-assertion": "off",
  "@typescript-eslint/no-this-alias": "off",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-function-type": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-return": "off",
  "@typescript-eslint/no-unused-expressions": ["error", { enforceForJSX: true }],
  "@typescript-eslint/no-unused-vars": "off",
  // Triple-slash `/// <reference path />` is the intended way to propagate an
  // ambient declaration (e.g. the `$vef` global in `components/_base/globals.ts`)
  // with the module that owns it; `import` cannot carry an ambient global.
  "@typescript-eslint/triple-slash-reference": "off"
};

// Rules: https://github.com/9romise/eslint-plugin-import-lite
const importRules: Linter.RulesRecord = {
  "import-lite/consistent-type-specifier-style": ["error", "top-level"],
  "import-lite/first": "error",
  "import-lite/newline-after-import": ["error", { count: 1 }],
  "import-lite/no-duplicates": "error",
  "import-lite/no-mutable-exports": "error",
  "import-lite/no-named-default": "error"
};

// Rules: https://github.com/sindresorhus/eslint-plugin-unicorn#rules
const unicornRules: Linter.RulesRecord = {
  "unicorn/consistent-empty-array-spread": "error",
  "unicorn/error-message": "error",
  "unicorn/escape-case": "error",
  "unicorn/filename-case": ["error", { case: "kebabCase", ignore: ["README.md", "AGENTS.md", "CLAUDE.md"] }],
  // `react` / `react-dom` allow named imports only: hooks and APIs are used
  // directly (`useState`, `createRoot`), never through the namespace
  // (`React.useState`). Type positions still read the ambient `React` UMD
  // namespace (`React.JSX.Element`) without an import.
  "unicorn/import-style": [
    "error",
    {
      checkDynamicImport: false,
      extendDefaultStyles: false,
      styles: {
        react: { named: true },
        "react-dom": { named: true },
        "react-dom/client": { named: true }
      }
    }
  ],
  "unicorn/new-for-builtins": "error",
  "unicorn/no-array-for-each": "error",
  "unicorn/no-array-reduce": "off",
  "unicorn/no-console-spaces": "error",
  "unicorn/no-empty-file": "error",
  "unicorn/no-for-loop": "error",
  "unicorn/no-nested-ternary": "off",
  "unicorn/no-new-array": "error",
  "unicorn/no-new-buffer": "error",
  "unicorn/no-null": "off",
  "unicorn/no-unnecessary-await": "error",
  "unicorn/no-unnecessary-polyfills": "error",
  "unicorn/no-unused-properties": "error",
  "unicorn/no-useless-promise-resolve-reject": "error",
  "unicorn/no-useless-spread": "error",
  "unicorn/no-useless-switch-case": "error",
  "unicorn/no-useless-undefined": "error",
  "unicorn/number-literal-case": "error",
  "unicorn/prefer-array-find": "error",
  "unicorn/prefer-array-flat": "error",
  "unicorn/prefer-array-flat-map": "error",
  "unicorn/prefer-array-index-of": "error",
  "unicorn/prefer-array-some": "error",
  "unicorn/prefer-date-now": "error",
  "unicorn/prefer-default-parameters": "error",
  "unicorn/prefer-dom-node-text-content": "error",
  "unicorn/prefer-event-target": "off",
  "unicorn/prefer-includes": "error",
  "unicorn/prefer-logical-operator-over-ternary": "error",
  "unicorn/prefer-node-protocol": "error",
  "unicorn/prefer-number-properties": "error",
  "unicorn/prefer-object-from-entries": "error",
  "unicorn/prefer-single-call": "error",
  "unicorn/prefer-string-raw": "error",
  "unicorn/prefer-string-starts-ends-with": "error",
  "unicorn/prefer-string-trim-start-end": "error",
  "unicorn/prefer-type-error": "error",
  "unicorn/prevent-abbreviations": "off",
  "unicorn/require-module-specifiers": "off",
  "unicorn/text-encoding-identifier-case": ["error", { withDash: true }],
  "unicorn/throw-new-error": "error"
};

// Rules: https://eslint-react.xyz/docs/rules/overview
const reactRules: Linter.RulesRecord = {
  "react-dom/no-dangerously-set-innerhtml": "error",
  "react-dom/no-dangerously-set-innerhtml-with-children": "error",
  "react-dom/no-find-dom-node": "error",
  "react-dom/no-flush-sync": "error",
  "react-dom/no-hydrate": "error",
  "react-dom/no-missing-button-type": "error",
  "react-dom/no-missing-iframe-sandbox": "error",
  "react-dom/no-render": "error",
  "react-dom/no-render-return-value": "error",
  "react-dom/no-script-url": "error",
  "react-dom/no-string-style-prop": "error",
  "react-dom/no-unknown-property": ["error", { ignore: ["css"] }],
  "react-dom/no-unsafe-iframe-sandbox": "error",
  "react-dom/no-unsafe-target-blank": "error",
  "react-dom/no-use-form-state": "error",
  "react-dom/no-void-elements-with-children": "error",
  "@eslint-react/set-state-in-effect": "off",
  // `static-components` flags valid TanStack Form patterns where stable
  // components are obtained from `useFormContext()` (e.g. `<Subscribe>`,
  // `<SubmitButton>`). The rule cannot distinguish these stable refs from
  // truly inline component definitions, so we disable it project-wide.
  "@eslint-react/static-components": "off",
  "react-jsx/no-key-after-spread": "error",
  "react-jsx/no-comment-textnodes": "error",
  "react-jsx/no-namespace": "error",
  "react-naming-convention/context-name": "error",
  "@eslint-react/no-access-state-in-setstate": "error",
  "@eslint-react/no-array-index-key": "off",
  "@eslint-react/no-children-for-each": "off",
  "@eslint-react/no-children-map": "off",
  "@eslint-react/no-children-to-array": "off",
  "@eslint-react/no-class-component": "error",
  "@eslint-react/no-clone-element": "off",
  "@eslint-react/no-component-will-mount": "error",
  "@eslint-react/no-component-will-receive-props": "error",
  "@eslint-react/no-component-will-update": "error",
  "@eslint-react/no-context-provider": "error",
  "@eslint-react/no-create-ref": "error",
  "@eslint-react/no-direct-mutation-state": "error",
  "@eslint-react/no-duplicate-key": "error",
  "@eslint-react/no-forward-ref": "error",
  "@eslint-react/no-missing-component-display-name": "error",
  "@eslint-react/no-missing-key": "error",
  "@eslint-react/no-nested-component-definitions": "error",
  "@eslint-react/no-set-state-in-component-did-mount": "error",
  "@eslint-react/no-set-state-in-component-did-update": "error",
  "@eslint-react/no-set-state-in-component-will-update": "error",
  "@eslint-react/no-unnecessary-use-prefix": "error",
  "@eslint-react/no-unsafe-component-will-mount": "error",
  "@eslint-react/no-unsafe-component-will-receive-props": "error",
  "@eslint-react/no-unsafe-component-will-update": "error",
  "@eslint-react/no-unstable-context-value": "error",
  "@eslint-react/no-unstable-default-props": "error",
  "@eslint-react/no-unused-class-component-members": "error",
  "@eslint-react/no-unused-state": "error",
  "@eslint-react/no-use-context": "error",
  "@eslint-react/unsupported-syntax": "error",
  "@eslint-react/use-state": [
    "error",
    {
      enforceAssignment: false,
      enforceLazyInitialization: true,
      enforceSetterName: false
    }
  ],
  "react-web-api/no-leaked-event-listener": "error",
  "react-web-api/no-leaked-interval": "error",
  "react-web-api/no-leaked-resize-observer": "error",
  "react-web-api/no-leaked-timeout": "error"
};

// Rules: https://react.dev/reference/eslint-plugin-react-hooks
const reactHooksRules: Linter.RulesRecord = {
  "react-hooks/component-hook-factories": "off",
  "react-hooks/config": "off",
  "react-hooks/error-boundaries": "off",
  "react-hooks/exhaustive-deps": ["error", { additionalHooks: "^use(Deep|Shallow|Isomorphic)|^useDidUpdate" }],
  "react-hooks/gating": "off",
  "react-hooks/globals": "off",
  "react-hooks/immutability": "off",
  "react-hooks/incompatible-library": "off",
  "react-hooks/preserve-manual-memoization": "off",
  "react-hooks/purity": "off",
  "react-hooks/refs": "off",
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/set-state-in-effect": "off",
  "react-hooks/set-state-in-render": "off",
  "react-hooks/static-components": "off",
  "react-hooks/unsupported-syntax": "off",
  "react-hooks/use-memo": "off"
};

// Rules: https://github.com/gajus/eslint-plugin-jsdoc#rules
const jsdocRules: Linter.RulesRecord = {
  "jsdoc/check-line-alignment": ["error", "always", { tags: [] }],
  "jsdoc/multiline-blocks": ["error", { noSingleLineBlocks: true }],
  "jsdoc/no-blank-blocks": "error",
  "jsdoc/tag-lines": ["error", "never", { startLines: 1 }]
};

// Rules: https://github.com/antfu/eslint-plugin-antfu#rules
const antfuRules: Linter.RulesRecord = {
  "antfu/consistent-chaining": "error",
  "antfu/consistent-list-newline": "error",
  "antfu/curly": "error",
  "antfu/if-newline": "error",
  "antfu/indent-unindent": "error",
  "antfu/top-level-function": "error"
};

// Rules: https://github.com/sweepline/eslint-plugin-unused-imports#usage
const unusedImportsRules: Linter.RulesRecord = {
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": [
    "error",
    {
      args: "after-used",
      argsIgnorePattern: "^_",
      vars: "all",
      varsIgnorePattern: "^_"
    }
  ]
};

// Rules: https://perfectionist.dev/rules
const perfectionistRules: Linter.RulesRecord = {
  "perfectionist/sort-exports": ["error", { order: "asc", type: "natural" }],
  "perfectionist/sort-imports": [
    "error",
    {
      groups: [
        "type-import",
        ["type-internal", "type-parent", "type-sibling", "type-index"],
        "value-builtin",
        "value-external",
        "value-internal",
        ["value-parent", "value-sibling", "value-index"],
        ["value-side-effect", "value-side-effect-style"],
        "unknown"
      ],
      newlinesBetween: 1,
      order: "asc",
      type: "natural"
    }
  ],
  "perfectionist/sort-jsx-props": [
    "error",
    {
      customGroups: [
        { elementNamePattern: "^(key|ref)$", groupName: "reserved" },
        { elementNamePattern: "^on.+", groupName: "callback" }
      ],
      groups: ["reserved", "shorthand-prop", "unknown", "multiline-prop", "callback"],
      ignoreCase: true,
      order: "asc",
      type: "natural"
    }
  ],
  "perfectionist/sort-named-exports": [
    "error",
    {
      groups: ["value-export", "type-export"],
      newlinesBetween: "ignore",
      order: "asc",
      type: "natural"
    }
  ],
  "perfectionist/sort-named-imports": [
    "error",
    {
      groups: ["value-import", "type-import"],
      newlinesBetween: "ignore",
      order: "asc",
      type: "natural"
    }
  ]
};

// Rules: https://eslint.style/rules
const stylisticRules: Linter.RulesRecord = {
  "@stylistic/array-bracket-newline": ["error", { multiline: true }],
  "@stylistic/array-element-newline": ["error", "consistent"],
  "@stylistic/arrow-parens": ["error", "as-needed"],
  "@stylistic/curly-newline": ["error", { consistent: true }],
  "@stylistic/function-paren-newline": ["error", "multiline-arguments"],
  "@stylistic/generator-star-spacing": ["error", { after: true, before: false }],
  "@stylistic/implicit-arrow-linebreak": ["error", "beside"],
  "@stylistic/jsx-max-props-per-line": ["error", { maximum: { multi: 1, single: 5 } }],
  "@stylistic/jsx-newline": ["error", { allowMultilines: true, prevent: true }],
  "@stylistic/jsx-self-closing-comp": ["error", { component: true, html: true }],
  "@stylistic/line-comment-position": ["error", { position: "above" }],
  "@stylistic/max-statements-per-line": ["error", { max: 1 }],
  "@stylistic/multiline-comment-style": ["error", "separate-lines", { checkJSDoc: false }],
  "@stylistic/newline-per-chained-call": ["error", { ignoreChainWithDepth: 6 }],
  "@stylistic/no-extra-parens": [
    "error",
    "all",
    {
      ignoreJSX: "multi-line",
      nestedBinaryExpressions: false,
      ternaryOperandBinaryExpressions: false
    }
  ],
  "@stylistic/no-extra-semi": "error",
  "@stylistic/no-multiple-empty-lines": [
    "error",
    {
      max: 1,
      maxBOF: 0,
      maxEOF: 0
    }
  ],
  "@stylistic/object-curly-newline": [
    "error",
    {
      ExportDeclaration: { consistent: true, multiline: true },
      ImportDeclaration: { consistent: true, multiline: true },
      ObjectExpression: {
        consistent: true,
        minProperties: 3,
        multiline: true
      },
      ObjectPattern: {
        consistent: true,
        minProperties: 3,
        multiline: true
      }
    }
  ],
  "@stylistic/object-property-newline": ["error", { allowAllPropertiesOnSameLine: true }],
  "@stylistic/padding-line-between-statements": [
    "error",
    {
      blankLine: "always",
      next: ["block", "multiline-block-like", "type", "interface", "enum", "function", "function-overload"],
      prev: "*"
    },
    {
      blankLine: "always",
      next: "*",
      prev: ["block", "multiline-block-like", "type", "interface", "enum", "function", "function-overload"]
    }
  ],
  "@stylistic/switch-colon-spacing": ["error", { after: true, before: false }],
  "@stylistic/yield-star-spacing": ["error", { after: true, before: false }]
};

// Rules: https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/
const eslintCommentsRules: Linter.RulesRecord = {
  "@eslint-community/eslint-comments/disable-enable-pair": "off",
  "@eslint-community/eslint-comments/no-unlimited-disable": "off"
};

// ============================================================================
// Format Configuration Helpers
// ============================================================================

type FormatParser = "css" | "scss" | "html" | "json" | "jsonc" | "markdown" | "mdx";

interface FormatConfigOptions {
  parser: FormatParser;
  additionalOptions?: Record<string, unknown>;
}

function createFormatConfig(filePattern: string, options: FormatConfigOptions): Linter.Config {
  const { parser, additionalOptions = {} } = options;

  return {
    files: [filePattern],
    languageOptions: {
      parser: format.parserPlain
    },
    plugins: {
      format
    },
    rules: {
      "format/prettier": [
        "error",
        {
          ...prettierOptions,
          parser,
          ...additionalOptions
        }
      ]
    }
  };
}

// ============================================================================
// Main Configuration
// ============================================================================

const SOURCE_FILE_PATTERNS = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"];
const NON_TSX_FILE_PATTERNS = ["**/*.ts", "**/*.js", "**/*.jsx"];
// Auto-generated artifacts that should not be linted:
// - `*.gen.ts` — generated route trees etc.
// - `mockServiceWorker.js` — emitted verbatim by `msw init`, regenerated on
//   every MSW upgrade; any local edits would be lost.
const IGNORED_FILES = ["**/*.gen.ts", "**/public/mockServiceWorker.js"];

export default defineConfig(
  gitignore({
    cwd: import.meta.dirname,
    root: true,
    strict: true
  }),
  // The `vef init` scaffold template is a self-contained consumer project carrying its OWN
  // eslint.config.ts / tsconfig. ESLint's per-file config resolution would discover and load that
  // nested config (which imports the built @vef-framework-react/dev and crashes under jiti), so
  // exclude the whole template — its formatting is governed by its own toolchain once scaffolded.
  {
    ignores: ["packages/dev/template/**"]
  },
  {
    files: SOURCE_FILE_PATTERNS,
    ignores: IGNORED_FILES,
    extends: [
      eslint.configs.recommended,
      tslint.configs.strict,
      tslint.configs.stylistic,
      react.configs["recommended-typescript"],
      reactHooks.configs.flat.recommended,
      importLite.configs.recommended,
      unicorn.configs.recommended,
      comments.recommended,
      regex.configs["flat/recommended"],
      stylistic.configs.customize({
        blockSpacing: true,
        braceStyle: "1tbs",
        commaDangle: "never",
        indent: 2,
        jsx: true,
        quoteProps: "as-needed",
        quotes: "double",
        semi: true,
        severity: "error"
      }),
      kitConfig
    ],
    plugins: {
      "react-dom": reactDom,
      "react-jsx": reactJsx,
      "react-naming-convention": reactNamingConvention,
      "react-web-api": reactWebApi,
      antfu,
      jsdoc,
      "local-react": localReactPlugin,
      perfectionist,
      "unused-imports": unusedImports
    },
    rules: {
      ...javascriptRules,
      ...typescriptRules,
      ...importRules,
      ...unicornRules,
      ...reactRules,
      ...localReactRules,
      ...reactHooksRules,
      ...antfuRules,
      ...unusedImportsRules,
      ...perfectionistRules,
      ...stylisticRules,
      ...jsdocRules,
      ...eslintCommentsRules
    }
  },
  {
    files: NON_TSX_FILE_PATTERNS,
    ignores: IGNORED_FILES,
    rules: {
      "no-restricted-syntax": [
        "error",
        "TSEnumDeclaration[const=true]",
        "TSExportAssignment",
        { selector: "JSXAttribute[name.name='ref'][value.type='Literal']", message: "Use callback refs or useRef instead of string refs." },
        { selector: "JSXAttribute[name.name='ref'] > JSXExpressionContainer > Literal", message: "Use callback refs or useRef instead of string refs." },
        { selector: "JSXAttribute[name.name='ref'] > JSXExpressionContainer > TemplateLiteral", message: "Use callback refs or useRef instead of string refs." },
        "JSXElement",
        "JSXFragment"
      ]
    }
  },
  {
    files: ["**/*.spec.{ts,tsx}"],
    ...jestDom.configs["flat/recommended"],
    ...testingLibrary.configs["flat/react"]
  },
  createFormatConfig("**/*.css", { parser: "css" }),
  createFormatConfig("**/*.scss", { parser: "scss" }),
  createFormatConfig("**/*.html", { parser: "html" }),
  createFormatConfig("**/*.json", { parser: "json" }),
  createFormatConfig("**/*.jsonc", { parser: "jsonc" }),
  createFormatConfig("**/*.md", { parser: "markdown", additionalOptions: { embeddedLanguageFormatting: "off", printWidth: 320 } }),
  createFormatConfig("**/*.mdx", { parser: "mdx", additionalOptions: { embeddedLanguageFormatting: "off", printWidth: 320 } })
);
