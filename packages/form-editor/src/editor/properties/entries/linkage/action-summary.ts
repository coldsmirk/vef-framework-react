import type { DataSourceApi, DynamicValue, FieldLinkageAction } from "../../../../types";

import { parseLeafSource } from "../../../../engine/linkage/scope";
import { findDataSourceApi } from "../../../data-source-apis";
import { actionLabelFor, alertLevelOptions } from "./options";

export interface ActionSummaryContext {
  apis: readonly DataSourceApi[];
  fieldLabels: ReadonlyMap<string, string>;
  dataSourceLabels: ReadonlyMap<string, string>;
}

export interface ActionSummary {
  title: string;
  detail: string;
  incomplete: boolean;
}

const MAX_SNIPPET_LENGTH = 20;

function truncate(text: string): string {
  return text.length > MAX_SNIPPET_LENGTH ? `${text.slice(0, MAX_SNIPPET_LENGTH)}…` : text;
}

function summarizeReferencePath(path: string, fieldLabels: ReadonlyMap<string, string>): string {
  const trimmed = path.trim();

  if (trimmed.length === 0) {
    return "";
  }

  const parsed = parseLeafSource(trimmed);

  switch (parsed.kind) {
    case "step": {
      return parsed.path.length > 0 ? `${parsed.step}.${parsed.path.join(".")}` : parsed.step;
    }

    case "form": {
      const label = fieldLabels.get(parsed.key) ?? parsed.key;

      return parsed.path.length > 0 ? `${label}.${parsed.path.join(".")}` : label;
    }

    case "context": {
      if (parsed.root === "$vars" && parsed.path.length > 0) {
        return parsed.path.join(".");
      }

      return trimmed;
    }

    case "unknown": {
      return trimmed;
    }
  }
}

function summarizeDynamicValue(value: DynamicValue, fieldLabels: ReadonlyMap<string, string>): string {
  if (value.kind === "literal") {
    if (value.value === undefined || value.value === null || value.value === "") {
      return "";
    }

    if (typeof value.value === "boolean") {
      return value.value ? "开启" : "关闭";
    }

    if (Array.isArray(value.value)) {
      return value.value.length > 0 ? truncate(value.value.join("、")) : "";
    }

    return truncate(String(value.value));
  }

  if (value.kind === "reference") {
    return summarizeReferencePath(value.path, fieldLabels);
  }

  return value.source.trim().length > 0 ? "表达式" : "";
}

/**
 * Plain-Chinese one-line summary of one linkage action for collapsed step rows
 * (e.g. "调用接口 · 职员查询 → result", "设置字段 · 写入 6 个字段"). Never
 * exposes internal schema keys such as `$steps` or `targetKey`.
 */
export function summarizeAction(action: FieldLinkageAction, ctx: ActionSummaryContext): ActionSummary {
  const title = actionLabelFor(action.type);

  switch (action.type) {
    case "api_call": {
      const api = findDataSourceApi(ctx.apis, action.request);
      const resource = action.request.resource.trim();
      const actionName = action.request.action.trim();
      const outputSuffix = action.output && action.output.trim().length > 0 ? ` → ${action.output.trim()}` : "";

      if (api !== undefined) {
        return {
          title,
          detail: `${api.label}${outputSuffix}`,
          incomplete: false
        };
      }

      if (resource.length > 0 && actionName.length > 0) {
        return {
          title,
          detail: `${resource} / ${actionName}${outputSuffix}`,
          incomplete: false
        };
      }

      return {
        title,
        detail: `未选择接口${outputSuffix}`,
        incomplete: true
      };
    }

    case "select_record": {
      const sourceText = summarizeDynamicValue(action.source, ctx.fieldLabels);
      const output = action.output.trim();
      const incomplete = sourceText.length === 0 || output.length === 0;
      const left = sourceText.length > 0 ? sourceText : "未选择来源";
      const right = output.length > 0 ? ` → ${output}` : "";

      return {
        title,
        detail: `${left}${right}`,
        incomplete
      };
    }

    case "set_fields": {
      const configured = action.assignments.filter(item => item.targetKey.trim().length > 0);

      if (configured.length === 0) {
        return {
          title,
          detail: "未配置写入项",
          incomplete: true
        };
      }

      const hasIncomplete = action.assignments.some(item => item.targetKey.trim().length === 0);

      if (configured.length === 1 && configured[0] !== undefined) {
        const label = ctx.fieldLabels.get(configured[0].targetKey) ?? configured[0].targetKey;

        return {
          title,
          detail: `写入「${label}」`,
          incomplete: hasIncomplete
        };
      }

      return {
        title,
        detail: `写入 ${configured.length} 个字段`,
        incomplete: hasIncomplete
      };
    }

    case "set_variable": {
      const name = action.variable.trim();

      if (name.length === 0) {
        return {
          title,
          detail: "未填写变量名",
          incomplete: true
        };
      }

      return {
        title,
        detail: `写入「${name}」`,
        incomplete: false
      };
    }

    case "refresh_data_source": {
      const id = action.dataSourceId.trim();

      if (id.length === 0) {
        return {
          title,
          detail: "未选择数据源",
          incomplete: true
        };
      }

      return {
        title,
        detail: ctx.dataSourceLabels.get(id) ?? id,
        incomplete: false
      };
    }

    case "alert": {
      const level = alertLevelOptions.find(option => option.value === (action.level ?? "info"))?.label ?? "信息";
      const text = summarizeDynamicValue(action.message, ctx.fieldLabels);

      return {
        title,
        detail: text.length > 0 ? `${level} · ${text}` : `${level} · 未填写内容`,
        incomplete: text.length === 0
      };
    }

    case "navigate": {
      const text = summarizeDynamicValue(action.to, ctx.fieldLabels);

      return {
        title,
        detail: text.length > 0 ? text : "未填写路径",
        incomplete: text.length === 0
      };
    }

    case "assign": {
      const text = summarizeDynamicValue(action.value, ctx.fieldLabels);

      return {
        title,
        detail: text.length > 0 ? text : "留空",
        incomplete: false
      };
    }

    case "script": {
      const hasCode = action.source.trim().length > 0;

      return {
        title,
        detail: hasCode ? "自定义脚本" : "未编写脚本",
        incomplete: !hasCode
      };
    }

    default: {
      return {
        title,
        detail: "",
        incomplete: false
      };
    }
  }
}

export function formatActionSummaryLine(summary: ActionSummary): string {
  return summary.detail.length > 0 ? `${summary.title} · ${summary.detail}` : summary.title;
}
