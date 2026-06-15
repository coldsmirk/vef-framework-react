import type { UserConfig } from "@commitlint/types";

import { RuleConfigSeverity } from "@commitlint/types";

const COMMITLINT_EXTENDS = ["@commitlint/config-conventional"] as const;
const COMMITLINT_FORMATTER = "@commitlint/format";

export function defineCommitlintConfig(): UserConfig {
  return {
    extends: [...COMMITLINT_EXTENDS],
    formatter: COMMITLINT_FORMATTER,
    rules: {
      "body-empty": [RuleConfigSeverity.Error, "always"],
      "footer-empty": [RuleConfigSeverity.Error, "always"]
    }
  };
}
