import type { ReactElement } from "react";

import type { Block, ContainerNode, CssLength, FlexSlot, StackSlot } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input, InputNumber, Segmented, Select } from "@vef-framework-react/components";

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
 * properties. The control adapts to the block's parent context: under a flex
 * container it edits the per-slot `flex` (grow / shrink / basis); under a grid it
 * edits the column `span`; under a table subform it edits the column's fixed
 * pixel width; otherwise (the document root or a section / tab / stack-subform
 * body) it edits the block's stack sizing — width with optional min / max bounds
 * and a horizontal alignment, full-width when left empty.
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

  // The document body and section / tabs / stack-subform bodies are vertical
  // stacks: a block is full-width by default, and this control lets it opt into a
  // fixed / bounded width and a horizontal placement. Side-by-side layout still
  // lives in an explicit grid / flex.
  return <StackSlotControl node={node} />;
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

const LENGTH_UNIT_OPTIONS = [
  { label: "px", value: "px" as const },
  { label: "%", value: "%" as const }
];

const ALIGN_OPTIONS = [
  { label: "靠左", value: "start" as const },
  { label: "居中", value: "center" as const },
  { label: "靠右", value: "end" as const }
];

/**
 * A single length control: a numeric value plus a px / % unit. Clearing the
 * number clears the length; the unit toggle is inert until a value is entered
 * (a length must carry both).
 */
function LengthRow({
  label,
  min = 0,
  onChange,
  value
}: {
  label: string;
  value: CssLength | undefined;
  min?: number;
  onChange: (next: CssLength | undefined) => void;
}): ReactElement {
  const unit = value?.unit ?? "px";

  return (
    <div css={rowCss}>
      <span css={labelCss}>{label}</span>

      <InputNumber
        min={min}
        placeholder="自动"
        style={controlStyle}
        value={value?.value}
        onChange={next => onChange(typeof next === "number" ? { value: next, unit } : undefined)}
      />

      <Segmented<CssLength["unit"]>
        disabled={value === undefined}
        options={LENGTH_UNIT_OPTIONS}
        value={unit}
        onChange={nextUnit => onChange(value === undefined ? undefined : { value: value.value, unit: nextUnit })}
      />
    </div>
  );
}

/**
 * Width sizing + horizontal placement for a block in a stack body — the control
 * the layout section shows when the block is NOT in a grid / flex / table
 * subform. Empty leaves the block full-width; a width (optionally bounded by
 * min / max) plus an alignment lets a field or group sit at a fixed size,
 * centered or edge-aligned. Mirrors {@link FlexSlotControl}'s merge-and-clean
 * write so an all-empty slot clears back to `undefined`.
 */
function StackSlotControl({ node }: { node: Block }): ReactElement {
  const storeApi = useFormEditorStoreApi();
  const { stack } = node;

  const patch = (next: Partial<StackSlot>): void => {
    const merged: StackSlot = { ...stack, ...next };
    const cleaned: StackSlot = {};

    if (merged.width !== undefined) {
      cleaned.width = merged.width;
    }

    if (merged.minWidth !== undefined) {
      cleaned.minWidth = merged.minWidth;
    }

    if (merged.maxWidth !== undefined) {
      cleaned.maxWidth = merged.maxWidth;
    }

    if (merged.align !== undefined) {
      cleaned.align = merged.align;
    }

    storeApi.getState().setStackSlot({
      nodeId: node.id,
      slot: Object.keys(cleaned).length > 0 ? cleaned : undefined
    });
  };

  return (
    <section css={sectionCss}>
      <span css={titleCss}>布局 · 宽度</span>
      <LengthRow label="宽度" min={1} value={stack?.width} onChange={width => patch({ width })} />
      <LengthRow label="最小宽度" value={stack?.minWidth} onChange={minWidth => patch({ minWidth })} />
      <LengthRow label="最大宽度" min={1} value={stack?.maxWidth} onChange={maxWidth => patch({ maxWidth })} />

      <div css={rowCss}>
        <span css={labelCss}>水平对齐</span>

        <Select<NonNullable<StackSlot["align"]>>
          allowClear
          options={ALIGN_OPTIONS}
          placeholder="默认（靠左）"
          style={controlStyle}
          value={stack?.align}
          onChange={align => patch({ align: align ?? undefined })}
        />
      </div>

      <span css={hintCss}>留空为满宽；设定宽度后可用最小 / 最大宽度做响应式约束，并选择水平对齐。</span>
    </section>
  );
}
