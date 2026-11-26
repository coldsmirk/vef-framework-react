import type { RemovalImpact } from "../engine/schema/removal-impact";
import type { FormEditorStoreApi } from "../store/form-store";

import { currentLayer } from "../engine/schema/presentation";
import { collectRemovalImpact, collectTabRemovalImpact, hasRemovalImpact } from "../engine/schema/removal-impact";
import { DialogLines, UNDOABLE_FOOTNOTE } from "./dialog-lines";
import { confirmDialog } from "./toolbar/notify";

/**
 * The impact rendered as one plain-text line per consequence — the single
 * source for both the rich modal body and the `$vef`-less native fallback's
 * `detail`, so the two surfaces can never drift.
 */
function removalImpactLines(impact: RemovalImpact): string[] {
  const lines: string[] = [];
  const ruleCount = impact.removedRules.reduce((sum, owner) => sum + owner.count, 0) + impact.formRulesRemoved;

  if (ruleCount > 0) {
    // ruleCount > 0 guarantees at least one source below, so the parenthetical
    // source list is never empty.
    const sources = [
      ...impact.removedRules.map(owner => `「${owner.ownerLabel}」`),
      ...impact.formRulesRemoved > 0 ? ["表单级事件"] : []
    ];

    lines.push(`将同时移除 ${ruleCount} 条引用它的联动规则（来自 ${sources.join("、")}）`);
  }

  const assignmentCount = impact.removedAssignments.reduce((sum, owner) => sum + owner.count, 0) + impact.formAssignmentsRemoved;

  if (assignmentCount > 0) {
    const sources = [
      ...impact.removedAssignments.map(owner => `「${owner.ownerLabel}」`),
      ...impact.formAssignmentsRemoved > 0 ? ["表单级事件"] : []
    ];

    lines.push(`将移除 ${assignmentCount} 处向该字段写入的赋值项（来自 ${sources.join("、")}）`);
  }

  const referenceCount = impact.clearedReferences.reduce((sum, owner) => sum + owner.count, 0)
    + impact.formReferencesCleared
    + impact.clearedDataSourceReferences.length;

  if (referenceCount > 0) {
    const sources = [
      ...impact.clearedReferences.map(owner => `「${owner.ownerLabel}」`),
      ...impact.formReferencesCleared > 0 ? ["表单级事件"] : [],
      ...impact.clearedDataSourceReferences.map(source => `数据源「${source.label}」`)
    ];

    lines.push(`将清空 ${referenceCount} 处对该字段的引用（来自 ${sources.join("、")}）`);
  }

  for (const field of impact.unreachable) {
    lines.push(`「${field.label}」默认隐藏且将失去全部「显示」规则，运行时将不可见`);
  }

  return lines;
}

/**
 * Remove a node through an impact-aware confirmation: when the removal would
 * cascade-prune linkage rules, drop write targets, clear references on OTHER
 * blocks / data sources, or strand a default-hidden field with no way to show,
 * the designer sees exactly what gets lost before committing. A removal with no
 * outside impact stays a single click.
 */
export function removeNodeWithConfirm(storeApi: FormEditorStoreApi, nodeId: string): void {
  const { device, schema } = storeApi.getState();
  const layer = currentLayer(schema, device);
  // The form-level linkage and form-global remote data sources resolve against
  // the PC root scope only.
  const impact = collectRemovalImpact(
    layer,
    nodeId,
    device === "pc" ? schema.linkage : undefined,
    device === "pc" ? schema.dataSources : undefined
  );

  confirmRemoval(impact, "删除该控件将影响联动或引用配置", () => storeApi.getState().removeNode(nodeId));
}

/**
 * Remove one tab through the same impact-aware confirmation. A tab body is a
 * whole subtree of fields, so deleting one must not be quieter than deleting
 * the container that holds it.
 */
export function removeTabWithConfirm(storeApi: FormEditorStoreApi, tabsId: string, tabId: string): void {
  const { device, schema } = storeApi.getState();
  const layer = currentLayer(schema, device);
  const impact = collectTabRemovalImpact(
    layer,
    tabsId,
    tabId,
    device === "pc" ? schema.linkage : undefined,
    device === "pc" ? schema.dataSources : undefined
  );

  confirmRemoval(impact, "删除该标签页将影响联动或引用配置", () => storeApi.getState().removeTab(tabsId, tabId));
}

function confirmRemoval(impact: RemovalImpact, title: string, commit: () => void): void {
  if (!hasRemovalImpact(impact)) {
    commit();
    return;
  }

  const lines = removalImpactLines(impact);

  confirmDialog(title, <DialogLines footnote={UNDOABLE_FOOTNOTE} lines={lines} />, {
    okText: "删除",
    okIcon: "trash-2",
    onOk: commit,
    detail: lines.join("\n")
  });
}
