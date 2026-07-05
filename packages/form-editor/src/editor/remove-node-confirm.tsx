import type { ReactElement } from "react";

import type { RemovalImpact } from "../engine/schema/removal-impact";
import type { FormEditorStoreApi } from "../store/form-store";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { currentLayer } from "../engine/schema/presentation";
import { collectRemovalImpact, hasRemovalImpact } from "../engine/schema/removal-impact";
import { confirmDialog } from "./toolbar/notify";

const summaryCss = css({
  margin: 0,
  paddingLeft: "1.2em",
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingXs,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.6,
  color: globalCssVars.colorTextSecondary,
  textAlign: "left"
});

const undoHintCss = css({
  listStyle: "none",
  marginTop: globalCssVars.spacingXs,
  color: globalCssVars.colorTextTertiary
});

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

  for (const field of impact.unreachable) {
    lines.push(`「${field.label}」默认隐藏且将失去全部「显示」规则，运行时将不可见`);
  }

  return lines;
}

function RemovalImpactSummary({ lines }: { lines: string[] }): ReactElement {
  return (
    <ul css={summaryCss}>
      {lines.map(line => <li key={line}>{line}</li>)}
      <li css={undoHintCss}>该操作可通过撤销恢复。</li>
    </ul>
  );
}

/**
 * Remove a node through an impact-aware confirmation: when the removal would
 * cascade-prune linkage rules on OTHER blocks (or strand a default-hidden
 * field with no way to show), the designer sees exactly what gets lost before
 * committing. A removal with no outside impact stays a single click.
 */
export function removeNodeWithConfirm(storeApi: FormEditorStoreApi, nodeId: string): void {
  const { device, schema } = storeApi.getState();
  const layer = currentLayer(schema, device);
  // The form-level linkage resolves against the PC root scope only.
  const impact = collectRemovalImpact(layer, nodeId, device === "pc" ? schema.linkage : undefined);

  if (!hasRemovalImpact(impact)) {
    storeApi.getState().removeNode(nodeId);
    return;
  }

  const lines = removalImpactLines(impact);

  confirmDialog(
    "删除该控件将影响联动规则",
    <RemovalImpactSummary lines={lines} />,
    {
      onOk: () => storeApi.getState().removeNode(nodeId),
      detail: lines.join("\n")
    }
  );
}
