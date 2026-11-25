const RULE_PATH = /(?:^|\.)linkage\.rules\[(?<rule>\d+)\](?:\.(?:actions\[(?<action>\d+)\]|(?<guard>trigger\.when)(?:\.|$)))?/;

export interface LinkageIssuePath {
  ruleIndex: number;
  /**
   * The step the issue is about; absent for the rule's trigger or the rule as
   * a whole.
   */
  actionIndex?: number;
  inWhenGuard: boolean;
}

/**
 * The rule, step, or event guard a linkage diagnostic's path names
 * (`node[f1].linkage.rules[0].actions[2].assignments[0].targetKey`), or
 * `undefined` when it names no rule.
 */
export function parseLinkageIssuePath(path: string): LinkageIssuePath | undefined {
  const groups = RULE_PATH.exec(path)?.groups;

  if (groups?.rule === undefined) {
    return undefined;
  }

  return {
    ruleIndex: Number(groups.rule),
    ...groups.action !== undefined && { actionIndex: Number(groups.action) },
    inWhenGuard: groups.guard !== undefined
  };
}
