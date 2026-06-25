import type { StylelintConfigOptions } from "@coldsmirk/stylelint-config";
import type { Config } from "stylelint";

import { defineStylelintConfig as defineCanonStylelintConfig } from "@coldsmirk/stylelint-config";

/**
 * The framework's Stylelint config. canon covers it fully; the only framework default is SCSS on
 * (canon defaults it off) since the framework's stylesheets are SCSS. Pass `{ scss: false }` for a
 * plain-CSS project.
 */
export function defineStylelintConfig(options: StylelintConfigOptions = {}): Config {
  return defineCanonStylelintConfig({ scss: true, ...options });
}
