import type { DragEndEvent } from "@vef-framework-react/core";
import type { ChangeEvent, Dispatch, ReactElement, SetStateAction } from "react";

import type { FieldOption } from "../../types";

import { css } from "@emotion/react";
import { Button, Checkbox, globalCssVars, Input } from "@vef-framework-react/components";
import { DragDropProvider, RestrictToVerticalAxis, useSortable } from "@vef-framework-react/core";
import { omit } from "@vef-framework-react/shared";
import { useRef, useState } from "react";

import {
  collectOptionValues,
  findDuplicateOptionValues,
  walkOptionTree
} from "../../engine/options";
import { EditorIcon } from "../../icons";
import { draggingRowCss, DragHandle, nextRowId, reorderRows } from "./sortable-rows";

const rootCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  containerType: "inline-size"
});

const emptyCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const flatItemCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6
});

const treeRowContainerCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "4px 6px",
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  background: globalCssVars.colorBgContainer
});

const treeRowNestedCss = css({
  borderLeft: `2px solid ${globalCssVars.colorBorder}`
});

const flatRowHeaderCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6
});

const treeRowHeaderCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6,

  "@container (min-width: 440px)": {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  }
});

const inputsGroupCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: 1,
  minWidth: 0
});

const actionsCss = css({
  display: "flex",
  alignItems: "center",
  gap: 2,
  flexShrink: 0,
  justifyContent: "flex-end"
});

const iconButtonCss = css({
  width: 24,
  height: 24,
  padding: 0,
  flexShrink: 0
});

const detailToggleActiveCss = css({
  color: globalCssVars.colorPrimary
});

const foldSpacerCss = css({
  width: 24,
  height: 24,
  flexShrink: 0
});

const detailSubRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 8,
  paddingLeft: 30
});

const detailCheckboxCss = css({
  flexShrink: 0
});

const duplicateWarningCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorWarningText,
  lineHeight: 1.5
});

const footerActionsCss = css({
  display: "flex",
  gap: 8
});

const bulkPanelCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  background: globalCssVars.colorFillQuaternary
});

const bulkHintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.4
});

const bulkActionsCss = css({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8
});

export interface OptionListEditorProps {
  options: FieldOption[];
  onChange: (next: FieldOption[]) => void;
  /**
   * Offer a "批量粘贴" inline mode (one item per line, auto-generating unique
   * `item_N` values) for long lists such as fixed-row checklist items. Enabled
   * automatically when {@link allowHierarchy} is true.
   */
  allowBulkPaste?: boolean;
  /**
   * Enable hierarchical editing (add child, indent/outdent, collapse/expand,
   * and indented bulk paste). Used in the form-global DataSource modal and on
   * `tree-select` / `tree-multi-select` fields; flat selection controls keep
   * inline static lists single-level. A list that already nests is always edited
   * as a hierarchy, so no level is hidden or flattened by an edit.
   */
  allowHierarchy?: boolean;
}

/**
 * An option's own data; its place in the tree is the row order and `depth`.
 */
type OptionData = Omit<FieldOption, "children">;

interface PreorderOptionEntry {
  depth: number;
  option: OptionData;
}

interface OptionTreeRow extends PreorderOptionEntry {
  id: string;
}

function nextUniqueItemValue(used: Set<string>, seqRef: { current: number }): string {
  while (used.has(`item_${seqRef.current}`)) {
    seqRef.current += 1;
  }

  const value = `item_${seqRef.current}`;

  used.add(value);
  seqRef.current += 1;

  return value;
}

/**
 * Parse newline-separated lines into flat `{ label, value }` options, trimming
 * each line and skipping blank lines. Values are minted sequentially as
 * `item_1`, `item_2`, … skipping any value already present in `existingValues`.
 */
export function parseBulkOptionLines(text: string, existingValues: ReadonlySet<string> = new Set()): FieldOption[] {
  const used = new Set(existingValues);
  const seqRef = { current: 1 };
  const parsed: FieldOption[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const label = rawLine.trim();

    if (label.length === 0) {
      continue;
    }

    parsed.push({ label, value: nextUniqueItemValue(used, seqRef) });
  }

  return parsed;
}

function measureLeadingIndent(line: string): number {
  let indent = 0;

  for (const char of line) {
    if (char === " ") {
      indent += 1;
    } else if (char === "\t") {
      indent += 2;
    } else {
      break;
    }
  }

  return indent;
}

/**
 * Parse indentation-nested lines into a hierarchical `FieldOption[]` tree.
 * Spaces (1 unit each) and tabs (2 units each) determine nesting depth relative
 * to earlier lines; blank lines are ignored, and every node receives a unique
 * `item_N` value skipping `existingValues`.
 */
export function parseIndentedOptionLines(
  text: string,
  existingValues: ReadonlySet<string> = new Set()
): FieldOption[] {
  const used = new Set(existingValues);
  const seqRef = { current: 1 };
  const roots: FieldOption[] = [];
  const stack: Array<{ indent: number; node: FieldOption }> = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const label = rawLine.trim();

    if (label.length === 0) {
      continue;
    }

    const indent = measureLeadingIndent(rawLine);
    const node: FieldOption = { label, value: nextUniqueItemValue(used, seqRef) };

    while (stack.length > 0 && stack.at(-1)!.indent >= indent) {
      stack.pop();
    }

    const parent = stack.at(-1)?.node;

    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children ??= [];
      parent.children.push(node);
    }

    stack.push({ indent, node });
  }

  return roots;
}

function patchOption(option: OptionData, patch: Partial<OptionData>): OptionData {
  const next: OptionData = { ...option, ...patch };

  if (next.disabled !== true) {
    delete next.disabled;
  }

  if (next.description === undefined || next.description.length === 0) {
    delete next.description;
  }

  return next;
}

function flattenOptionRows(options: readonly FieldOption[]): PreorderOptionEntry[] {
  const rows: PreorderOptionEntry[] = [];

  walkOptionTree(options, (option, { depth }) => {
    rows.push({ depth, option: omit(option, ["children"]) });
  });

  return rows;
}

function rebuildOptionTree(rows: readonly PreorderOptionEntry[]): FieldOption[] {
  const roots: FieldOption[] = [];
  const stack: Array<{ depth: number; node: FieldOption }> = [];

  for (const row of rows) {
    const node: FieldOption = { ...row.option };

    while (stack.length > 0 && stack.at(-1)!.depth >= row.depth) {
      stack.pop();
    }

    const parent = stack.at(-1)?.node;

    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children ??= [];
      parent.children.push(node);
    }

    stack.push({ depth: row.depth, node });
  }

  return roots;
}

function subtreeEnd(rows: readonly OptionTreeRow[], index: number): number {
  const baseDepth = rows[index]!.depth;
  let end = index + 1;

  while (end < rows.length && rows[end]!.depth > baseDepth) {
    end += 1;
  }

  return end;
}

function findParentIndex(rows: readonly OptionTreeRow[], index: number): number {
  const targetDepth = rows[index]!.depth - 1;

  if (targetDepth < 0) {
    return -1;
  }

  for (let i = index - 1; i >= 0; i -= 1) {
    if (rows[i]!.depth === targetDepth) {
      return i;
    }
  }

  return -1;
}

function findPrevSiblingIndex(rows: readonly OptionTreeRow[], index: number): number {
  const baseDepth = rows[index]!.depth;

  for (let i = index - 1; i >= 0; i -= 1) {
    const { depth } = rows[i]!;

    if (depth < baseDepth) {
      return -1;
    }

    if (depth === baseDepth) {
      return i;
    }
  }

  return -1;
}

function findNextSiblingIndex(rows: readonly OptionTreeRow[], index: number): number {
  const end = subtreeEnd(rows, index);

  return end < rows.length && rows[end]!.depth === rows[index]!.depth ? end : -1;
}

function OptionDetailFields({
  onChange,
  option
}: {
  option: OptionData;
  onChange: (patch: Partial<OptionData>) => void;
}): ReactElement {
  return (
    <div css={detailSubRowCss}>
      <Input
        aria-label="选项描述"
        placeholder="次要描述（可选，搜索也匹配）"
        size="small"
        value={option.description ?? ""}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ description: event.target.value })}
      />

      <Checkbox
        checked={option.disabled === true}
        css={detailCheckboxCss}
        onChange={event => onChange({ disabled: event.target.checked })}
      >
        禁用
      </Checkbox>
    </div>
  );
}

interface VisibleOptionRow {
  row: OptionTreeRow;
  index: number;
  hasChildren: boolean;
  collapsed: boolean;
  canIndent: boolean;
  canOutdent: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

interface OptionRowProps extends VisibleOptionRow {
  containerRef?: (element: Element | null) => void;
  detailsOpen: boolean;
  dragHandle?: ReactElement;
  duplicated: boolean;
  hierarchical: boolean;
  isDragging?: boolean;
  onAddChild: () => void;
  onIndent: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onOutdent: () => void;
  onPatch: (patch: Partial<OptionData>) => void;
  onRemove: () => void;
  onToggleCollapsed: () => void;
  onToggleDetails: () => void;
}

/**
 * Unified row renderer shared by flat and hierarchical option lists. Every row
 * is keyed by its stable ephemeral `row.id` so open details, collapse state,
 * and input focus follow the logical option across deletes, sibling moves,
 * indent/outdent, and drag reordering.
 */
function OptionRow({
  canIndent,
  canMoveDown,
  canMoveUp,
  canOutdent,
  collapsed,
  containerRef,
  detailsOpen,
  dragHandle,
  duplicated,
  hasChildren,
  hierarchical,
  isDragging = false,
  onAddChild,
  onIndent,
  onMoveDown,
  onMoveUp,
  onOutdent,
  onPatch,
  onRemove,
  onToggleCollapsed,
  onToggleDetails,
  row
}: OptionRowProps): ReactElement {
  const { depth, option } = row;
  const hasDetailMeta = option.disabled === true || (option.description !== undefined && option.description.length > 0);
  const indentPx = Math.min(depth, 6) * 14;

  return (
    <div
      ref={containerRef}
      style={indentPx > 0 ? { marginLeft: indentPx } : undefined}
      css={hierarchical
        ? [treeRowContainerCss, depth > 0 && treeRowNestedCss]
        : [flatItemCss, isDragging && draggingRowCss]}
    >
      <div css={hierarchical ? treeRowHeaderCss : flatRowHeaderCss}>
        <div css={inputsGroupCss}>
          {hierarchical
            ? hasChildren
              ? (
                  <Button
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? "展开子项" : "折叠子项"}
                    css={iconButtonCss}
                    icon={<EditorIcon name={collapsed ? "chevron-right" : "chevron-down"} />}
                    size="small"
                    title={collapsed ? "展开子项" : "折叠子项"}
                    type="text"
                    onClick={onToggleCollapsed}
                  />
                )
              : <span aria-hidden css={foldSpacerCss} />
            : dragHandle}

          <Input
            placeholder="标签"
            value={option.label}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onPatch({ label: event.target.value })}
          />

          <Input
            placeholder="值"
            status={duplicated ? "warning" : undefined}
            value={String(option.value)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onPatch({ value: event.target.value })}
          />
        </div>

        <div css={actionsCss}>
          {hierarchical
            ? (
                <>
                  <Button
                    aria-label="添加子项"
                    css={iconButtonCss}
                    icon={<EditorIcon name="corner-down-right" />}
                    size="small"
                    title="添加子项"
                    type="text"
                    onClick={onAddChild}
                  />

                  <Button
                    aria-label="升级"
                    css={iconButtonCss}
                    disabled={!canOutdent}
                    icon={<EditorIcon name="indent-decrease" />}
                    size="small"
                    title="升级为上级同级项"
                    type="text"
                    onClick={onOutdent}
                  />

                  <Button
                    aria-label="降级"
                    css={iconButtonCss}
                    disabled={!canIndent}
                    icon={<EditorIcon name="indent-increase" />}
                    size="small"
                    title="降级为前一项的子项"
                    type="text"
                    onClick={onIndent}
                  />

                  <Button
                    aria-label="上移"
                    css={iconButtonCss}
                    disabled={!canMoveUp}
                    icon={<EditorIcon name="chevron-up" />}
                    size="small"
                    title="同级上移"
                    type="text"
                    onClick={onMoveUp}
                  />

                  <Button
                    aria-label="下移"
                    css={iconButtonCss}
                    disabled={!canMoveDown}
                    icon={<EditorIcon name="chevron-down" />}
                    size="small"
                    title="同级下移"
                    type="text"
                    onClick={onMoveDown}
                  />
                </>
              )
            : null}

          <Button
            aria-expanded={detailsOpen}
            aria-label="选项详情"
            css={[iconButtonCss, (detailsOpen || hasDetailMeta) && detailToggleActiveCss]}
            icon={<EditorIcon name="sliders-horizontal" />}
            size="small"
            title="描述与禁用"
            type="text"
            onClick={onToggleDetails}
          />

          <Button
            aria-label="删除选项"
            css={iconButtonCss}
            icon={<EditorIcon name="trash-2" />}
            size="small"
            title="删除选项"
            type="text"
            onClick={onRemove}
          />
        </div>
      </div>

      {detailsOpen ? <OptionDetailFields option={option} onChange={onPatch} /> : null}
    </div>
  );
}

function SortableOptionRow(props: Omit<OptionRowProps, "containerRef" | "dragHandle" | "isDragging">): ReactElement {
  const { index, row } = props;
  const {
    handleRef,
    isDragging,
    ref
  } = useSortable({ id: row.id, index });

  return (
    <OptionRow
      {...props}
      containerRef={ref}
      dragHandle={<DragHandle handleRef={handleRef} />}
      isDragging={isDragging}
    />
  );
}

/**
 * Inline editor for a static option list or tree. Internally flattens the tree
 * into pre-order rows (`{ id, depth, option }`) with ephemeral row IDs kept in
 * lockstep with every edit, so a flat list is simply a depth-0 tree and every
 * structural edit (add, remove, indent, outdent, sibling move, drag reorder)
 * preserves row identity, focus, open detail drawers, and collapse state.
 */
export function OptionListEditor({
  allowBulkPaste = false,
  allowHierarchy = false,
  onChange,
  options
}: OptionListEditorProps): ReactElement {
  const rowIdsRef = useRef<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [openDetails, setOpenDetails] = useState<Set<string>>(() => new Set());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  const flatEntries = flattenOptionRows(options);

  if (rowIdsRef.current.length !== flatEntries.length) {
    rowIdsRef.current = flatEntries.map(() => nextRowId());
  }

  const rows: OptionTreeRow[] = flatEntries.map((entry, index) => {
    return {
      id: rowIdsRef.current[index]!,
      depth: entry.depth,
      option: entry.option
    };
  });

  const hierarchical = allowHierarchy || rows.some(row => row.depth > 0);
  const duplicated = findDuplicateOptionValues(options);
  const bulkPasteEnabled = allowBulkPaste || hierarchical;

  const commitRows = (nextRows: readonly OptionTreeRow[]): void => {
    rowIdsRef.current = nextRows.map(row => row.id);
    onChange(rebuildOptionTree(nextRows));
  };

  const toggleInSet = (setter: Dispatch<SetStateAction<Set<string>>>, id: string): void => {
    setter(prev => prev.symmetricDifference(new Set([id])));
  };

  const expand = (id: string): void => {
    setCollapsedIds(prev => prev.difference(new Set([id])));
  };

  const patchRow = (index: number, patch: Partial<OptionData>): void => {
    const current = rows[index]!;

    commitRows(rows.with(index, { ...current, option: patchOption(current.option, patch) }));
  };

  const removeRow = (index: number): void => {
    commitRows(rows.toSpliced(index, subtreeEnd(rows, index) - index));
  };

  const addRootRow = (): void => {
    commitRows([
      ...rows,
      {
        id: nextRowId(),
        depth: 0,
        option: { label: "", value: "" }
      }
    ]);
  };

  const addChildRow = (index: number): void => {
    const parent = rows[index]!;
    const child: OptionTreeRow = {
      id: nextRowId(),
      depth: parent.depth + 1,
      option: { label: "", value: "" }
    };

    expand(parent.id);
    commitRows(rows.toSpliced(subtreeEnd(rows, index), 0, child));
  };

  const indentRow = (index: number): void => {
    const prevSiblingIndex = findPrevSiblingIndex(rows, index);

    if (prevSiblingIndex === -1) {
      return;
    }

    const end = subtreeEnd(rows, index);

    expand(rows[prevSiblingIndex]!.id);
    commitRows(rows.map((row, current) => current >= index && current < end
      ? { ...row, depth: row.depth + 1 }
      : row));
  };

  const outdentRow = (index: number): void => {
    const parentIndex = findParentIndex(rows, index);

    if (parentIndex === -1) {
      return;
    }

    const end = subtreeEnd(rows, index);
    const parentEnd = subtreeEnd(rows, parentIndex);
    const movedBlock = rows.slice(index, end).map(row => {
      return { ...row, depth: row.depth - 1 };
    });
    const trailingSiblings = rows.slice(end, parentEnd);

    commitRows([...rows.slice(0, index), ...trailingSiblings, ...movedBlock, ...rows.slice(parentEnd)]);
  };

  const moveSiblingRow = (index: number, direction: -1 | 1): void => {
    if (direction === -1) {
      const prevIndex = findPrevSiblingIndex(rows, index);

      if (prevIndex === -1) {
        return;
      }

      const end = subtreeEnd(rows, index);

      commitRows([...rows.slice(0, prevIndex), ...rows.slice(index, end), ...rows.slice(prevIndex, index), ...rows.slice(end)]);
      return;
    }

    const nextIndex = findNextSiblingIndex(rows, index);

    if (nextIndex === -1) {
      return;
    }

    const nextEnd = subtreeEnd(rows, nextIndex);

    commitRows([...rows.slice(0, index), ...rows.slice(nextIndex, nextEnd), ...rows.slice(index, nextIndex), ...rows.slice(nextEnd)]);
  };

  const applyBulkPaste = (mode: "append" | "replace"): void => {
    const existingValues = mode === "append" ? collectOptionValues(options) : new Set<string>();
    const parsed = hierarchical
      ? parseIndentedOptionLines(bulkText, existingValues)
      : parseBulkOptionLines(bulkText, existingValues);

    if (parsed.length === 0) {
      setBulkOpen(false);
      setBulkText("");
      return;
    }

    const parsedRows: OptionTreeRow[] = flattenOptionRows(parsed).map(entry => {
      return {
        id: nextRowId(),
        depth: entry.depth,
        option: entry.option
      };
    });

    if (mode === "replace") {
      setOpenDetails(new Set());
      setCollapsedIds(new Set());
      commitRows(parsedRows);
    } else {
      commitRows([...rows, ...parsedRows]);
    }

    setBulkOpen(false);
    setBulkText("");
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const result = reorderRows(rows, rowIdsRef.current, event);

    if (result !== null) {
      commitRows(result.rows);
    }
  };

  const visibleRows: VisibleOptionRow[] = [];
  let hiddenAboveDepth: number | null = null;

  for (const [index, row] of rows.entries()) {
    if (hiddenAboveDepth !== null) {
      if (row.depth > hiddenAboveDepth) {
        continue;
      }

      hiddenAboveDepth = null;
    }

    const hasChildren = index + 1 < rows.length && rows[index + 1]!.depth > row.depth;
    const collapsed = hasChildren && collapsedIds.has(row.id);

    if (collapsed) {
      hiddenAboveDepth = row.depth;
    }

    const hasPrevSibling = findPrevSiblingIndex(rows, index) !== -1;

    visibleRows.push({
      row,
      index,
      hasChildren,
      collapsed,
      canIndent: hasPrevSibling,
      canOutdent: row.depth > 0,
      canMoveUp: hasPrevSibling,
      canMoveDown: findNextSiblingIndex(rows, index) !== -1
    });
  }

  const renderRow = (item: VisibleOptionRow): ReactElement => {
    const { index, row } = item;
    const rowProps = {
      ...item,
      detailsOpen: openDetails.has(row.id),
      duplicated: duplicated.includes(String(row.option.value)),
      hierarchical,
      onAddChild: () => addChildRow(index),
      onIndent: () => indentRow(index),
      onMoveDown: () => moveSiblingRow(index, 1),
      onMoveUp: () => moveSiblingRow(index, -1),
      onOutdent: () => outdentRow(index),
      onPatch: (patch: Partial<OptionData>) => patchRow(index, patch),
      onRemove: () => removeRow(index),
      onToggleCollapsed: () => toggleInSet(setCollapsedIds, row.id),
      onToggleDetails: () => toggleInSet(setOpenDetails, row.id)
    };

    return hierarchical
      ? <OptionRow key={row.id} {...rowProps} />
      : <SortableOptionRow key={row.id} {...rowProps} />;
  };

  const renderedRows = visibleRows.map(item => renderRow(item));

  return (
    <div css={rootCss}>
      {rows.length === 0 ? <span css={emptyCss}>暂无选项</span> : null}

      {hierarchical
        ? renderedRows
        : (
            // Scoped to its own DragDropProvider so an option-row drag never routes
            // into the editor canvas's drag context (the properties panel renders
            // inside the canvas provider). Restricted to the vertical axis, as a
            // plain reorderable list.
            <DragDropProvider modifiers={[RestrictToVerticalAxis]} onDragEnd={handleDragEnd}>
              {renderedRows}
            </DragDropProvider>
          )}

      {duplicated.length > 0
        ? <span css={duplicateWarningCss}>{`选项值重复：${duplicated.join("、")}`}</span>
        : null}

      {bulkOpen
        ? (
            <div css={bulkPanelCss}>
              <span css={bulkHintCss}>
                {hierarchical
                  ? "每行一项，用空格或 Tab 缩进表示层级；空行自动忽略，系统将自动生成唯一值"
                  : "每行一项，空行自动忽略；系统将自动生成唯一值"}
              </span>

              <Input.TextArea
                aria-label="批量粘贴行项目"
                autoSize={{ minRows: 4, maxRows: 10 }}
                value={bulkText}
                placeholder={hierarchical
                  ? "例如：\n华东\n  上海\n  杭州\n华北\n  北京"
                  : "例如：\n第一项\n第二项\n第三项"}
                onChange={event => setBulkText(event.target.value)}
              />

              <div css={bulkActionsCss}>
                <Button
                  size="small"
                  onClick={() => {
                    setBulkOpen(false);
                    setBulkText("");
                  }}
                >
                  取消
                </Button>

                {rows.length > 0
                  ? (
                      <Button size="small" onClick={() => applyBulkPaste("append")}>
                        追加
                      </Button>
                    )
                  : null}

                <Button size="small" type="primary" onClick={() => applyBulkPaste("replace")}>
                  {rows.length > 0 ? "替换全部" : "导入"}
                </Button>
              </div>
            </div>
          )
        : (
            <div css={footerActionsCss}>
              <Button block icon={<EditorIcon name="plus" />} type="dashed" onClick={addRootRow}>
                添加选项
              </Button>

              {bulkPasteEnabled
                ? (
                    <Button block icon={<EditorIcon name="clipboard-list" />} onClick={() => setBulkOpen(true)}>
                      批量粘贴
                    </Button>
                  )
                : null}
            </div>
          )}
    </div>
  );
}
