import type { DataSourceApi, DynamicValue, FieldLinkageAction } from "../../../../types";
import type { LinkageScope } from "./use-linkage-editor-model";

import { findDataSourceApi } from "../../../../engine/data-source-apis";
import { parseLeafSource } from "../../../../engine/linkage/scope";
import { actionLabelFor, alertLevelOptions } from "./options";

export interface ActionSummary {
  text: string;
  /**
   * Whether the step still lacks something it needs to run.
   */
  incomplete: boolean;
}

const MAX_SNIPPET_LENGTH = 20;

function truncate(text: string): string {
  return text.length > MAX_SNIPPET_LENGTH ? `${text.slice(0, MAX_SNIPPET_LENGTH)}…` : text;
}

function describeReference(path: string, scope: LinkageScope): string {
  const parsed = parseLeafSource(path.trim());

  switch (parsed.kind) {
    case "step": {
      return [parsed.step, ...parsed.path].join(".");
    }

    case "form": {
      return [scope.fieldsByKey.get(parsed.key)?.label || parsed.key, ...parsed.path].join(".");
    }

    case "context": {
      if (parsed.root === "$vars") {
        return parsed.path.join(".");
      }

      return scope.reference.contextSources.find(source => source.key === path)?.label ?? path;
    }

    case "unknown": {
      return path;
    }
  }
}

function describeValue(value: DynamicValue, scope: LinkageScope): string {
  switch (value.kind) {
    case "literal": {
      if (typeof value.value === "boolean") {
        return value.value ? "开启" : "关闭";
      }

      return truncate(Array.isArray(value.value) ? value.value.join("、") : String(value.value ?? ""));
    }

    case "reference": {
      return describeReference(value.path, scope);
    }

    case "expression": {
      return value.source.trim().length > 0 ? "表达式" : "";
    }
  }
}

function withOutput(text: string, output: string | undefined): string {
  return output ? `${text} → ${output}` : text;
}

/**
 * What the step does, after its type: `undefined` when that says it all.
 */
function describeAction(
  action: FieldLinkageAction,
  scope: LinkageScope,
  apis: readonly DataSourceApi[]
): { detail: string; incomplete: boolean } | undefined {
  switch (action.type) {
    case "api_call": {
      const endpoint = [action.request.resource.trim(), action.request.action.trim()];
      const isConfigured = endpoint.every(part => part.length > 0);
      const label = findDataSourceApi(apis, action.request)?.label ?? (isConfigured ? endpoint.join(" / ") : "未选择接口");

      return { detail: withOutput(label, action.output), incomplete: !isConfigured };
    }

    case "select_record": {
      const source = describeValue(action.source, scope);

      return {
        detail: withOutput(source || "未选择来源", action.output),
        incomplete: source.length === 0 || action.output.length === 0
      };
    }

    case "set_fields": {
      const [first, ...others] = action.assignments.filter(item => item.targetKey.length > 0);

      if (first === undefined) {
        return { detail: "未配置写入项", incomplete: true };
      }

      return {
        detail: others.length === 0
          ? `写入「${scope.fieldsByKey.get(first.targetKey)?.label || first.targetKey}」`
          : `写入 ${others.length + 1} 个字段`,
        incomplete: others.length + 1 < action.assignments.length
      };
    }

    case "set_variable": {
      return action.variable.length > 0
        ? { detail: `写入「${action.variable}」`, incomplete: false }
        : { detail: "未填写变量名", incomplete: true };
    }

    case "refresh_data_source": {
      return action.dataSourceId.length > 0
        ? {
            detail: scope.dataSourceOptions.find(option => option.value === action.dataSourceId)?.label ?? action.dataSourceId,
            incomplete: false
          }
        : { detail: "未选择数据源", incomplete: true };
    }

    case "alert": {
      const level = alertLevelOptions.find(option => option.value === (action.level ?? "info"))?.label;
      const message = describeValue(action.message, scope);

      return { detail: `${level} · ${message || "未填写内容"}`, incomplete: message.length === 0 };
    }

    case "navigate": {
      const to = describeValue(action.to, scope);

      return { detail: to || "未填写路径", incomplete: to.length === 0 };
    }

    case "assign": {
      return { detail: describeValue(action.value, scope) || "留空", incomplete: false };
    }

    case "script": {
      return action.source.trim().length > 0
        ? { detail: "自定义脚本", incomplete: false }
        : { detail: "未编写脚本", incomplete: true };
    }

    default: {
      return undefined;
    }
  }
}

/**
 * One action in one line, in the designer's words: "调用接口 · 职员查询 → result",
 * "设置字段 · 写入 6 个字段".
 */
export function summarizeAction(
  action: FieldLinkageAction,
  scope: LinkageScope,
  apis: readonly DataSourceApi[]
): ActionSummary {
  const title = actionLabelFor(action.type);
  const description = describeAction(action, scope, apis);

  return description === undefined
    ? { text: title, incomplete: false }
    : { text: `${title} · ${description.detail}`, incomplete: description.incomplete };
}
