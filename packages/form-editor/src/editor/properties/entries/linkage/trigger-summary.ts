import type { KeyedFormField, LinkageCondition, LinkageContextSource, LinkageTrigger } from "../../../../types";

import { assertNever } from "../../../../engine/assert-never";
import { coerceToString } from "../coerce";
import { describeReference, truncateSnippet } from "./action-summary";
import { operatorLabelFor, operatorNeedsValue, triggerLabelFor } from "./options";

export interface TriggerSummaryScope {
  fieldsByKey: ReadonlyMap<string, Pick<KeyedFormField, "label">>;
  contextSources: readonly LinkageContextSource[];
  /**
   * Display name of the owning field or container; omitted for form-level
   * events whose triggers already name the form lifecycle.
   */
  ownerLabel?: string;
}

const EMPTY_CONDITION_LABEL = "未配置条件";
const EXPRESSION_CONDITION_LABEL = "满足表达式";

function describeCondition(
  condition: LinkageCondition,
  scope: Pick<TriggerSummaryScope, "contextSources" | "fieldsByKey">,
  nested = false
): string {
  let current = condition;

  while (current.kind === "group" && current.children.length === 1 && current.children[0] !== undefined) {
    current = current.children[0];
  }

  switch (current.kind) {
    case "expression": {
      return EXPRESSION_CONDITION_LABEL;
    }

    case "leaf": {
      const source = current.sourceKey.trim().length > 0
        ? describeReference(current.sourceKey, scope)
        : "未选字段";
      const operator = operatorLabelFor(current.operator);

      if (!operatorNeedsValue(current.operator)) {
        return `${source} ${operator}`;
      }

      const rawValue = coerceToString(current.value).trim();

      return `${source} ${operator} ${rawValue.length > 0 ? truncateSnippet(rawValue) : "（未填）"}`;
    }

    case "group": {
      const [first, second] = current.children;

      if (first === undefined) {
        return EMPTY_CONDITION_LABEL;
      }

      const connector = current.logic === "all" ? "且" : "或";

      if (current.children.length === 2 && second !== undefined) {
        const text = `${describeCondition(first, scope, true)} ${connector} ${describeCondition(second, scope, true)}`;

        return nested ? `（${text}）` : text;
      }

      const logicLabel = current.logic === "all" ? "全部" : "任一";
      const text = `${describeCondition(first, scope, true)} 等 ${current.children.length} 项（${logicLabel}）`;

      return nested ? `（${text}）` : text;
    }

    default: {
      return assertNever(current);
    }
  }
}

function withWhenSuffix(text: string): string {
  if (text === EMPTY_CONDITION_LABEL) {
    return text;
  }

  if (text === EXPRESSION_CONDITION_LABEL) {
    return `${EXPRESSION_CONDITION_LABEL}时`;
  }

  return `${text} 时`;
}

const EVENT_PHRASE_STYLE: Record<
  Exclude<LinkageTrigger["kind"], "condition">,
  "plain" | "formPrefix" | "timeSuffix"
> = {
  load: "plain",
  beforeSubmit: "formPrefix",
  afterSubmit: "formPrefix",
  change: "plain",
  commit: "plain",
  click: "plain",
  focus: "timeSuffix",
  blur: "timeSuffix"
};

function formatEventPhrase(kind: Exclude<LinkageTrigger["kind"], "condition">): string {
  const label = triggerLabelFor(kind);
  const style = EVENT_PHRASE_STYLE[kind];

  switch (style) {
    case "formPrefix": {
      return `表单${label}`;
    }

    case "timeSuffix": {
      return `${label}时`;
    }

    case "plain": {
      return label;
    }

    default: {
      return assertNever(style);
    }
  }
}

function isFormLifecycleTrigger(kind: Exclude<LinkageTrigger["kind"], "condition">): boolean {
  return kind === "load" || kind === "beforeSubmit" || kind === "afterSubmit";
}

/**
 * One rule trigger in one line of designer Chinese for the compact rule list:
 * e.g. "年龄 大于等于 18 时", "年龄 输入完成时", "表单加载时", "满足表达式时".
 */
export function summarizeTrigger(trigger: LinkageTrigger, scope: TriggerSummaryScope): string {
  if (trigger.kind === "condition") {
    return withWhenSuffix(describeCondition(trigger.condition, scope));
  }

  const phrase = formatEventPhrase(trigger.kind);
  const owner = scope.ownerLabel?.trim();
  const base = !isFormLifecycleTrigger(trigger.kind) && owner && owner.length > 0
    ? `${owner} ${phrase}`
    : phrase;

  if (trigger.when === undefined) {
    return base;
  }

  const guard = describeCondition(trigger.when, scope);

  return guard === EMPTY_CONDITION_LABEL ? base : `${base} · ${guard}`;
}
