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

function RemovalImpactSummary({ impact }: { impact: RemovalImpact }): ReactElement {
  const ruleCount = impact.removedRules.reduce((sum, owner) => sum + owner.count, 0) + impact.formRulesRemoved;
  const owners = impact.removedRules.map(owner => `「${owner.ownerLabel}」`).join("、");

  return (
    <ul css={summaryCss}>
      {ruleCount > 0
        ? (
            <li>
              将同时移除
              {" "}
              {ruleCount}
              {" "}
              条引用它的联动规则
              {owners.length > 0 ? `（来自 ${owners}` : ""}

              {impact.formRulesRemoved > 0
                ? `${owners.length > 0 ? "、" : "（来自 "}表单级事件`
                : ""}

              {owners.length > 0 || impact.formRulesRemoved > 0 ? "）" : ""}
            </li>
          )
        : null}

      {impact.unreachable.map(field => (
        <li key={field.id}>
          「
          {field.label}
          」默认隐藏且将失去全部「显示」规则，运行时将不可见
        </li>
      ))}

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

  confirmDialog(
    "删除该控件将影响联动规则",
    <RemovalImpactSummary impact={impact} />,
    () => storeApi.getState().removeNode(nodeId)
  );
}
