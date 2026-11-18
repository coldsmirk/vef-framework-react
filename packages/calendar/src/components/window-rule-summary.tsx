import type { WindowRule } from "../types";

import { formatWindowRule } from "./format-window-rule";

export function WindowRuleSummary({ rule }: { rule?: WindowRule }) {
  return <span>{formatWindowRule(rule)}</span>;
}
