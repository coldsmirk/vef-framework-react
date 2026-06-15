import type { Config } from "stylelint";

import propertyGroups from "stylelint-config-recess-order/groups";

// ============================================================================
// Rule Definitions
// ============================================================================

const ALLOWED_UNITS = ["px", "em", "rem", "%", "vw", "vh", "fr", "deg", "rad", "grad", "turn", "ms", "s"];

const orderRules: Config["rules"] = {
  "order/order": [
    "dollar-variables",
    "at-variables",
    "custom-properties",
    "less-mixins",
    "declarations",
    "at-rules",
    "rules"
  ],
  "order/properties-order": propertyGroups.map(group => {
    return {
      ...group,
      emptyLineBefore: "never",
      noEmptyLineBetween: true
    };
  })
};

const declarationRules: Config["rules"] = {
  "declaration-empty-line-before": "never",
  "declaration-property-value-no-unknown": [true, { ignoreProperties: {} }]
};

const scssRules: Config["rules"] = {
  "at-rule-no-unknown": null,
  "function-no-unknown": null,
  "scss/at-rule-no-unknown": [true, { ignoreAtRules: ["extend", "include"] }],
  "scss/function-no-unknown": [true, { ignoreFunctions: [] }]
};

const colorRules: Config["rules"] = {
  "color-hex-alpha": "never",
  "color-hex-length": "long",
  "color-named": "never"
};

const selectorRules: Config["rules"] = {
  "selector-pseudo-class-no-unknown": [true, { ignorePseudoClasses: ["global"] }]
};

const valueRules: Config["rules"] = {
  "number-max-precision": null,
  "unit-allowed-list": ALLOWED_UNITS
};

// ============================================================================
// Main Configuration
// ============================================================================

export function defineStylelintConfig(): Config {
  return {
    extends: [
      "stylelint-config-recommended",
      "stylelint-config-standard-scss",
      "@stylistic/stylelint-config"
    ],
    plugins: ["stylelint-order"],
    rules: {
      ...orderRules,
      ...declarationRules,
      ...scssRules,
      ...colorRules,
      ...selectorRules,
      ...valueRules
    }
  };
}
