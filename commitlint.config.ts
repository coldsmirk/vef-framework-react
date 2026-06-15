import type { UserConfig } from "@commitlint/types";

import { RuleConfigSeverity } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  formatter: "@commitlint/format",
  rules: {
    "body-empty": [RuleConfigSeverity.Error, "always"],
    "footer-empty": [RuleConfigSeverity.Error, "always"]
  }
};

export default config;
