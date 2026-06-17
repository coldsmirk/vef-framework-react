import type { ReactElement } from "react";

import type { Block, ContainerNode, FlexSlot } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input, InputNumber } from "@vef-framework-react/components";

import { gridColumnCount } from "../../render/grid-style";
import { useFormEditorStoreApi } from "../../store/form-store";

const sectionCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 10,
  paddingBottom: 18,
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const titleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText
});

const rowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 8
});

const labelCss = css({
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorTextSecondary,
  width: 88,
  flexShrink: 0
});

const hintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const controlStyle = { flex: 1 } as const;

export interface BlockLayoutSectionProps {
  node: Block;
  /**
   * The container directly owning `node`. Already resolved by the properties
   * panel's fused walk (`findNodeWithParentContainer`) and passed down, so this
   * section never re-walks the tree per keystroke.
   */
  parent: ContainerNode | undefined;
}

/**
 * Layout sizing for the selected block, shown above its type-specific
 * properties. The control adapts to the block's parent container: under a flex
 * container it edits the per-slot `flex` (grow / basis); under a table subform it
 * edits the column's fixed pixel width; anywhere else (a grid row) it edits the
 * column `span` — an empty span means auto, sharing the row's leftover width with
 * the other auto blocks.
 */
export function BlockLayoutSection({ node, parent }: BlockLayoutSectionProps): ReactElement | null {
  if (parent?.type === "flex") {
    return <FlexSlotControl node={node} />;
  }

  if (parent?.type === "grid") {
    return <GridSlotControl columns={gridColumnCount(parent)} node={node} />;
  }

  // A table subform lays its template fields out as columns, so the field's only
  // sizing knob is the column width (a fixed pixel value, or auto when empty).
  // The stack subform keeps the free vertical layout, which needs no sizing.
  if (parent?.type === "subform" && parent.variant === "table") {
    return <TableColumnWidthControl node={node} />;
  }

  // The document body and section / tabs / stack-subform bodies are single-block
  // vertical stacks — a block always fills the width, so there is nothing to
  // size here. Side-by-side layout is configured inside an explicit grid / flex.
  return null;
}

function GridSlotControl({ columns, node }: { columns: number; node: Block }): ReactElement {
  const storeApi = useFormEditorStoreApi();

  const setSpan = (span: number | undefined): void => {
    storeApi.getState().setSpan({ nodeId: node.id, span });
  };

  return (
    <section css={sectionCss}>
      <span css={titleCss}>布局 · 占用列数</span>

      <div css={rowCss}>
        <span css={labelCss}>跨列数</span>

        <InputNumber
          max={columns}
          min={1}
          placeholder="1"
          style={controlStyle}
          value={node.span}
          onChange={value => setSpan(typeof value === "number" ? value : undefined)}
        />

        <Button disabled={node.span === undefined} type="text" onClick={() => setSpan(undefined)}>
          重置
        </Button>
      </div>

      <span css={hintCss}>
        本栅格共
        {" "}
        {columns}
        {" "}
        列。留空占 1 列，设为
        {" "}
        {columns}
        {" "}
        则铺满整行。
      </span>
    </section>
  );
}

function TableColumnWidthControl({ node }: { node: Block }): ReactElement {
  const storeApi = useFormEditorStoreApi();

  const setWidth = (width: number | undefined): void => {
    storeApi.getState().setColumnWidth({ nodeId: node.id, width });
  };

  return (
    <section css={sectionCss}>
      <span css={titleCss}>布局 · 列宽</span>

      <div css={rowCss}>
        <span css={labelCss}>列宽 (px)</span>

        <InputNumber
          min={1}
          placeholder="自动"
          style={controlStyle}
          value={node.columnWidth}
          onChange={value => setWidth(typeof value === "number" ? value : undefined)}
        />

        <Button disabled={node.columnWidth === undefined} type="text" onClick={() => setWidth(undefined)}>
          重置
        </Button>
      </div>

      <span css={hintCss}>留空则按表格剩余空间自动分配；设为固定像素后，该列不再随容器宽度伸缩。</span>
    </section>
  );
}

function FlexSlotControl({ node }: { node: Block }): ReactElement {
  const storeApi = useFormEditorStoreApi();
  const { flex } = node;

  const patch = (next: Partial<FlexSlot>): void => {
    const merged: FlexSlot = { ...flex, ...next };
    const cleaned: FlexSlot = {};

    if (typeof merged.grow === "number") {
      cleaned.grow = merged.grow;
    }

    if (typeof merged.shrink === "number") {
      cleaned.shrink = merged.shrink;
    }

    if (typeof merged.basis === "string" && merged.basis.length > 0) {
      cleaned.basis = merged.basis;
    }

    storeApi.getState().setFlex({
      nodeId: node.id,
      flex: Object.keys(cleaned).length > 0 ? cleaned : undefined
    });
  };

  return (
    <section css={sectionCss}>
      <span css={titleCss}>布局 · 弹性占比</span>

      <div css={rowCss}>
        <span css={labelCss}>放大比例</span>

        <InputNumber
          min={0}
          placeholder="0"
          style={controlStyle}
          value={flex?.grow}
          onChange={value => patch({ grow: typeof value === "number" ? value : undefined })}
        />
      </div>

      <div css={rowCss}>
        <span css={labelCss}>缩小比例</span>

        <InputNumber
          min={0}
          placeholder="1"
          style={controlStyle}
          value={flex?.shrink}
          onChange={value => patch({ shrink: typeof value === "number" ? value : undefined })}
        />
      </div>

      <div css={rowCss}>
        <span css={labelCss}>基准宽度</span>

        <Input
          placeholder="auto / 200px / 30%"
          style={controlStyle}
          value={flex?.basis ?? ""}
          onChange={event => patch({ basis: event.target.value })}
        />
      </div>

      <span css={hintCss}>放大比例 &gt; 0 时，该元素按比例分占多余空间；缩小比例 &gt; 0 时，空间不足时按比例收缩（默认 1）；基准宽度为槽位的初始宽度。</span>
    </section>
  );
}
