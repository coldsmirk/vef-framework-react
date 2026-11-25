import type {
  Block,
  DataSourceApi,
  DynamicValue,
  FieldLinkage,
  FieldOptionSource,
  FormDataSource,
  FormSchema,
  PresentationDevice,
  PresentationLayer
} from "../../types";

import { isKeyedNode } from "../../engine/keys";
import { getActionDataSourceId } from "../../engine/linkage/action-descriptors";
import { isLeafField, nodeLabel, walkNodes } from "../../engine/schema/walk";
import { findDataSourceApi } from "../data-source-apis";

export interface DataSourceFieldRef {
  device: PresentationDevice;
  nodeId: string;
  label: string;
  kind: "field" | "fixed-subform";
}

export interface DataSourceLinkageRef {
  /**
   * `"form"` for form-level `schema.linkage`, else the owning block's device.
   */
  scope: "form" | PresentationDevice;
  ownerLabel: string;
  actionCount: number;
  removedRuleCount: number;
}

/**
 * Every reference to one form-global data source across the whole schema:
 * leaf-field `ref` option sources, fixed-row subform `ref` row sources, and
 * `refresh_data_source` linkage actions (both per-node and form-level).
 * Mirrors `pruneDataSourceReferences` so the list badge and the delete
 * confirmation dialog always report the exact references `removeDataSource`
 * will clear.
 */
export interface DataSourceUsage {
  total: number;
  fields: DataSourceFieldRef[];
  fixedSubforms: DataSourceFieldRef[];
  linkages: DataSourceLinkageRef[];
}

export interface DataSourceSummary {
  text: string;
  incomplete: boolean;
}

const MAX_LISTED_REFS = 8;

const usageCache = new WeakMap<FormSchema, ReadonlyMap<string, DataSourceUsage>>();

function getOrCreateUsage(map: Map<string, DataSourceUsage>, id: string): DataSourceUsage {
  const existing = map.get(id);

  if (existing !== undefined) {
    return existing;
  }

  const fresh: DataSourceUsage = {
    total: 0,
    fields: [],
    fixedSubforms: [],
    linkages: []
  };

  map.set(id, fresh);

  return fresh;
}

function displayNodeName(node: Block, device: PresentationDevice): string {
  const base = nodeLabel(node) ?? (isKeyedNode(node) ? node.key : node.id);

  return device === "mobile" ? `移动端 · ${base}` : base;
}

function collectLinkageUsages(
  linkage: FieldLinkage | undefined,
  scope: "form" | PresentationDevice,
  ownerLabel: string,
  map: Map<string, DataSourceUsage>
): void {
  const rules = linkage?.rules;

  if (rules === undefined || rules.length === 0) {
    return;
  }

  // Group per dataSourceId for this owner so multiple rules on the same owner
  // fold into one entry in the delete confirmation while keeping exact counts.
  const bySource = new Map<string, { actionCount: number; removedRuleCount: number }>();

  for (const rule of rules) {
    const actionsPerSource = new Map<string, number>();

    for (const action of rule.actions) {
      const slot = getActionDataSourceId(action);

      if (slot !== undefined && typeof slot.value === "string" && slot.value.length > 0) {
        actionsPerSource.set(slot.value, (actionsPerSource.get(slot.value) ?? 0) + 1);
      }
    }

    for (const [dataSourceId, matchedCount] of actionsPerSource) {
      const stats = bySource.get(dataSourceId) ?? { actionCount: 0, removedRuleCount: 0 };

      stats.actionCount += matchedCount;

      if (matchedCount === rule.actions.length) {
        stats.removedRuleCount += 1;
      }

      bySource.set(dataSourceId, stats);
    }
  }

  for (const [dataSourceId, stats] of bySource) {
    const usage = getOrCreateUsage(map, dataSourceId);

    usage.total += stats.actionCount;
    usage.linkages.push({
      scope,
      ownerLabel,
      actionCount: stats.actionCount,
      removedRuleCount: stats.removedRuleCount
    });
  }
}

function collectLayerUsages(
  layer: PresentationLayer | undefined,
  device: PresentationDevice,
  map: Map<string, DataSourceUsage>
): void {
  if (layer === undefined) {
    return;
  }

  walkNodes(layer, node => {
    if (isLeafField(node)) {
      const { dataSource } = node as { dataSource?: FieldOptionSource };

      if (dataSource?.kind === "ref" && dataSource.dataSourceId.length > 0) {
        const usage = getOrCreateUsage(map, dataSource.dataSourceId);

        usage.total += 1;
        usage.fields.push({
          device,
          nodeId: node.id,
          label: displayNodeName(node, device),
          kind: "field"
        });
      }
    } else if (
      node.type === "subform"
      && node.rows?.mode === "fixed"
      && node.rows.source.kind === "ref"
      && node.rows.source.dataSourceId.length > 0
    ) {
      const usage = getOrCreateUsage(map, node.rows.source.dataSourceId);

      usage.total += 1;
      usage.fixedSubforms.push({
        device,
        nodeId: node.id,
        label: displayNodeName(node, device),
        kind: "fixed-subform"
      });
    }

    if (node.linkage !== undefined) {
      collectLinkageUsages(node.linkage, device, displayNodeName(node, device), map);
    }
  });
}

/**
 * Collect reference counts and locations for every data source referenced in
 * `schema` in a single traversal, memoized by schema identity.
 */
export function collectDataSourceUsages(schema: FormSchema): ReadonlyMap<string, DataSourceUsage> {
  const cached = usageCache.get(schema);

  if (cached !== undefined) {
    return cached;
  }

  const map = new Map<string, DataSourceUsage>();

  collectLayerUsages(schema.presentations.pc, "pc", map);
  collectLayerUsages(schema.presentations.mobile, "mobile", map);
  collectLinkageUsages(schema.linkage, "form", "表单级事件", map);

  usageCache.set(schema, map);

  return map;
}

function formatRefNames(items: readonly string[], unit: string): string {
  const visible = items.slice(0, MAX_LISTED_REFS).map(name => `「${name}」`);

  if (items.length <= MAX_LISTED_REFS) {
    return visible.join("、");
  }

  return `${visible.join("、")}等共 ${items.length} ${unit}`;
}

/**
 * Plain-text impact bullets for the data-source delete confirmation dialog
 * (shared between the rich `<DialogLines>` body and the native fallback's
 * `detail`).
 */
export function formatDataSourceRemovalLines(usage: DataSourceUsage): string[] {
  const lines: string[] = [];

  if (usage.fields.length > 0) {
    lines.push(`以下字段将清空选项来源：${formatRefNames(usage.fields.map(item => item.label), "个字段")}`);
  }

  if (usage.fixedSubforms.length > 0) {
    lines.push(`以下固定行明细表将清空行项目来源：${formatRefNames(usage.fixedSubforms.map(item => item.label), "个明细表")}`);
  }

  if (usage.linkages.length > 0) {
    const actionCount = usage.linkages.reduce((sum, item) => sum + item.actionCount, 0);
    const removedRuleCount = usage.linkages.reduce((sum, item) => sum + item.removedRuleCount, 0);
    const sources = usage.linkages.map(item => item.scope === "form" ? item.ownerLabel : `「${item.ownerLabel}」`);
    const listedSources = sources.length <= MAX_LISTED_REFS
      ? sources.join("、")
      : `${sources.slice(0, MAX_LISTED_REFS).join("、")}等 ${sources.length} 处`;
    const ruleSuffix = removedRuleCount > 0 ? `，其中 ${removedRuleCount} 条规则将被一并移除` : "";

    lines.push(`将移除 ${actionCount} 个联动刷新动作（来自 ${listedSources}）${ruleSuffix}`);
  }

  return lines;
}

function isDynamicValueUnbound(value: DynamicValue | undefined): boolean {
  if (value === undefined) {
    return true;
  }

  switch (value.kind) {
    case "literal": {
      return value.value === undefined || value.value === "";
    }

    case "reference": {
      return value.path.trim().length === 0;
    }

    case "expression": {
      return value.source.trim().length === 0;
    }
  }
}

/**
 * One-line summary for a data source row in the sidebar's `数据` tab, plus
 * whether its configuration is still incomplete so the row can highlight it.
 */
export function summarizeDataSource(source: FormDataSource, apis: readonly DataSourceApi[]): DataSourceSummary {
  if (source.kind === "static") {
    return {
      text: `静态 · ${source.options.length} 项`,
      incomplete: source.options.length === 0
    };
  }

  const resource = source.request.resource.trim();
  const action = source.request.action.trim();

  if (resource.length === 0 && action.length === 0) {
    return { text: "接口 · 未配置", incomplete: true };
  }

  if (resource.length === 0) {
    return { text: `接口 · 未配置 / ${action}`, incomplete: true };
  }

  if (action.length === 0) {
    return { text: `接口 · ${resource} / 未配置`, incomplete: true };
  }

  const api = findDataSourceApi(apis, source.request);

  if (api !== undefined) {
    const missingRequiredParam = (api.params ?? []).some(
      param => param.required === true && isDynamicValueUnbound(source.request.params?.[param.name])
    );

    return missingRequiredParam
      ? { text: `接口 · ${api.label}（缺少必填参数）`, incomplete: true }
      : { text: `接口 · ${api.label}`, incomplete: false };
  }

  return { text: `接口 · ${resource} / ${action}`, incomplete: false };
}

/**
 * Generate a unique copy name (`<name> 副本`, `<name> 副本 2`, …) that never
 * collides with any trimmed name already in `existingNames`.
 */
export function nextCopyName(baseName: string, existingNames: ReadonlySet<string>): string {
  const stem = baseName.trim().length > 0 ? baseName.trim() : "数据源";
  const first = `${stem} 副本`;

  if (!existingNames.has(first)) {
    return first;
  }

  let seq = 2;

  while (existingNames.has(`${stem} 副本 ${seq}`)) {
    seq += 1;
  }

  return `${stem} 副本 ${seq}`;
}
