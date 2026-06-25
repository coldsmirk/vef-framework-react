import type { DynamicIconName } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { Block } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { memo } from "react";

import { containerBodies } from "../../engine/schema/nodes";
import { isContainerNode, nodeLabel } from "../../engine/schema/walk";
import { EditorIcon } from "../../icons";
import { useFieldRegistry } from "../../store/engine-provider";
import { useCurrentLayer, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";

const bodyCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "14px 12px 20px"
});

const emptyCss = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "40px 24px",
  textAlign: "center"
});

// A soft, neutral icon badge anchors the empty state — a tree glyph that mirrors
// what the outline becomes once it has content.
const emptyIconCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  marginBottom: 6,
  borderRadius: globalCssVars.borderRadiusLg,
  background: globalCssVars.colorFillQuaternary,
  color: globalCssVars.colorTextQuaternary,

  "& svg": {
    width: 22,
    height: 22
  }
});

const emptyTitleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary
});

const emptyHintCss = css({
  maxWidth: 200,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.6,
  color: globalCssVars.colorTextTertiary
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

const rowSelectedCss = css({
  background: globalCssVars.colorPrimaryBg,
  color: globalCssVars.colorPrimary,

  "&:hover": {
    background: globalCssVars.colorPrimaryBg
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
  fontVariantNumeric: "tabular-nums",
  color: globalCssVars.colorTextTertiary
});

export function OutlineTab(): ReactElement {
  const layer = useCurrentLayer();

  return (
    <div css={bodyCss}>
      {layer.children.length === 0
        ? (
            <div css={emptyCss}>
              <span css={emptyIconCss}>
                <EditorIcon name="list-tree" />
              </span>

              <span css={emptyTitleCss}>还没有任何字段</span>
              <span css={emptyHintCss}>从左侧组件库拖入组件，字段结构会显示在这里</span>
            </div>
          )
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
        : layer.children.map(block => <BlockNode key={block.id} block={block} depth={0} />)}
    </div>
  );
}

// Memoized by block reference (mirroring the canvas's EditorBlock): with the
// drawer open during property keystrokes, only the edited block's outline row
// re-renders instead of the whole tree.
const BlockNode = memo(function BlockNode({ block, depth }: { block: Block; depth: number }): ReactElement {
  const registry = useFieldRegistry();
  const storeApi = useFormEditorStoreApi();
  // Subscribe to the derived boolean, not the raw selectedId: otherwise every
  // outline row re-renders on any selection change. With Object.is on a boolean
  // only the deselected and newly selected rows re-render.
  const isSelected = useFormEditorStore(s => s.selectedId === block.id);

  const definition = registry.get(block.type);
  const icon: DynamicIconName = definition?.config.icon ?? "square";
  // `key` is an optional probe on the union (keyed leaves and subforms carry it):
  // it backs the label when a node has no label/title, and the trailing key tag.
  const nodeKey = "key" in block && typeof block.key === "string" && block.key.length > 0 ? block.key : undefined;
  const label = nodeLabel(block) ?? nodeKey ?? definition?.config.name ?? block.type;
  const keyTag = isContainerNode(block) ? undefined : nodeKey;

  return (
    <>
      <div
        css={[rowCss, isSelected && rowSelectedCss]}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => storeApi.getState().selectNode(block.id)}
      >
        <EditorIcon name={icon} />
        <span css={labelTextCss}>{label}</span>
        {keyTag ? <span css={keyTagCss}>{keyTag}</span> : null}
      </div>

      {isContainerNode(block)
        ? containerBodies(block).flat().map(child => <BlockNode key={child.id} block={child} depth={depth + 1} />)
        : null}
    </>
  );
});
