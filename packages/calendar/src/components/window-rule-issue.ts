import type { WindowRule } from "../types";

export function windowRuleIssue(rule?: WindowRule) {
  if (rule?.windows.length === 0) {
    return "请至少添加一个开放窗口";
  }

  if (rule && [...rule.windows, ...rule.blackouts ?? []].some(window => window.times?.some(range => range.startsAt === range.endsAt))) {
    return "请修改起止时间相同的时段";
  }
}
