import type { DynamicIconName } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { Block } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { nodeLabel, walkNodes } from "../../engine/schema/walk";
import { EditorIcon } from "../../icons";
import { useFieldRegistry } from "../../store/engine-provider";
import { useCurrentLayer, useFormEditorStoreApi } from "../../store/form-store";

const listCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 2
});

const rowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "5px 8px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorText,
  transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover": {
    background: globalCssVars.colorFillTertiary
  }
});

const labelTextCss = css({
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const keyTagCss = css({
  fontSize: 11,
  color: globalCssVars.colorTextTertiary
});

const countTagCss = css({
  padding: "0 6px",
  borderRadius: 9,
  background: globalCssVars.colorFillSecondary,
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
  color: globalCssVars.colorTextSecondary,
  whiteSpace: "nowrap"
});

const emptyHintCss = css({
  padding: "2px 8px",
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

interface LinkageBearerRow {
  block: Block;
  ruleCount: number;
}

/**
 * Read-only index of every node on the active layer that carries linkage
 * rules — the field-level share of the footer's "联动" count. Rules are
 * authored per field, so each row simply selects its node: the properties
 * panel then shows the field whose 联动 tab owns the rules.
 */
export function LinkageOverview(): ReactElement {
  const layer = useCurrentLayer();
  const registry = useFieldRegistry();
  const storeApi = useFormEditorStoreApi();

  const rows: LinkageBearerRow[] = [];
  walkNodes(layer, block => {
    const ruleCount = block.linkage?.rules?.length ?? 0;

    if (ruleCount > 0) {
      rows.push({ block, ruleCount });
    }
  });

  if (rows.length === 0) {
    return <div css={emptyHintCss}>当前设备层还没有字段级联动规则，可在控件属性面板的「联动」页配置。</div>;
  }

  return (
    <div css={listCss}>
      {rows.map(({ block, ruleCount }) => {
        const definition = registry.get(block.type);
        const icon: DynamicIconName = definition?.config.icon ?? "square";
        const nodeKey = "key" in block && typeof block.key === "string" && block.key.length > 0 ? block.key : undefined;
        const label = nodeLabel(block) ?? nodeKey ?? definition?.config.name ?? block.type;

        return (
          <div
            key={block.id}
            css={rowCss}
            onClick={() => storeApi.getState().selectNode(block.id)}
          >
            <EditorIcon name={icon} />
            <span css={labelTextCss}>{label}</span>
            {nodeKey ? <span css={keyTagCss}>{nodeKey}</span> : null}

            <span css={countTagCss}>
              {ruleCount}
              {" "}
              条规则
            </span>
          </div>
        );
      })}
    </div>
  );
}
