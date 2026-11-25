import type { DragEndEvent } from "@vef-framework-react/core";
import type { ChangeEvent, ReactElement } from "react";

import type { FieldOption } from "../../types";

import { css } from "@emotion/react";
import { Button, Checkbox, globalCssVars, Input } from "@vef-framework-react/components";
import { DragDropProvider, moveDragItem, RestrictToVerticalAxis, useSortable } from "@vef-framework-react/core";
import { useRef, useState } from "react";

import {
  collectOptionValues,
  findDuplicateOptionValues,
  hasOptionChildren
} from "../../engine/options";
import { EditorIcon } from "../../icons";

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

const optionRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6
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

// The drag grip that reorders a flat row. Quiet by default, brightening on
// hover/focus; focusable so dnd-kit's KeyboardSensor can pick the row up with
// Enter and move it with the arrow keys.
const dragHandleCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  flexShrink: 0,
  borderRadius: globalCssVars.borderRadiusSm,
  color: globalCssVars.colorTextTertiary,
  cursor: "grab",
  transition: [
    `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", "),

  "&:hover": {
    color: globalCssVars.colorText,
    background: globalCssVars.colorFillTertiary
  },

  "&:focus-visible": {
    outline: "none",
    color: globalCssVars.colorText,
    background: globalCssVars.colorFillTertiary,
    boxShadow: `0 0 0 2px ${globalCssVars.colorPrimaryBorder}`
  },

  "&:active": {
    cursor: "grabbing"
  },

  "& > svg": {
    width: 14,
    height: 14
  }
});

// The row lifts to a solid, shadowed surface while dragging so it reads as
// picked-up above its neighbours.
const optionRowDraggingCss = css({
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgElevated,
  boxShadow: globalCssVars.shadowLg
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

const treeInputsGroupCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: 1,
  minWidth: 0
});

const treeActionsCss = css({
  display: "flex",
  alignItems: "center",
  gap: 2,
  flexShrink: 0,
  justifyContent: "flex-end"
});

const foldSpacerCss = css({
  width: 24,
  height: 24,
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

export type OptionTreePath = readonly number[];

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
   * inline static lists single-level.
   */
  allowHierarchy?: boolean;
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

function withNormalizedChildren(option: FieldOption, children: FieldOption[] | undefined): FieldOption {
  if (children === undefined || children.length === 0) {
    const next: FieldOption = { ...option };

    delete next.children;

    return next;
  }

  return { ...option, children };
}

function patchOptionMetadata(option: FieldOption, patch: Partial<FieldOption>): FieldOption {
  const next: FieldOption = { ...option, ...patch };

  if (next.disabled !== true) {
    delete next.disabled;
  }

  if (next.description === undefined || next.description.length === 0) {
    delete next.description;
  }

  return withNormalizedChildren(next, next.children);
}

/**
 * Immutably update the option at `path` inside a hierarchical option tree.
 */
export function updateOptionAtPath(
  options: readonly FieldOption[],
  path: OptionTreePath,
  updater: (option: FieldOption) => FieldOption
): FieldOption[] {
  const [head, ...rest] = path;

  if (head === undefined) {
    return [...options];
  }

  return options.map((option, index) => {
    if (index !== head) {
      return option;
    }

    if (rest.length === 0) {
      return updater(option);
    }

    return withNormalizedChildren(option, updateOptionAtPath(option.children ?? [], rest, updater));
  });
}

/**
 * Immutably remove the option (and its subtree) at `path`.
 */
export function removeOptionAtPath(options: readonly FieldOption[], path: OptionTreePath): FieldOption[] {
  const [head, ...rest] = path;

  if (head === undefined) {
    return [...options];
  }

  if (rest.length === 0) {
    return options.filter((_option, index) => index !== head);
  }

  return options.map((option, index) => index === head
    ? withNormalizedChildren(option, removeOptionAtPath(option.children ?? [], rest))
    : option);
}

/**
 * Append a blank child option under the node at `path`.
 */
export function addChildOptionAtPath(options: readonly FieldOption[], path: OptionTreePath): FieldOption[] {
  return updateOptionAtPath(options, path, option => {
    const children = [...option.children ?? [], { label: "", value: "" }];

    return { ...option, children };
  });
}

/**
 * Demote (indent) the option at `path` into the last child of its immediately
 * preceding sibling. Returns `null` when the node has no preceding sibling.
 */
export function indentOptionAtPath(
  options: readonly FieldOption[],
  path: OptionTreePath
): { options: FieldOption[]; nextPath: number[] } | null {
  const leafIndex = path.at(-1);

  if (leafIndex === undefined || leafIndex === 0) {
    return null;
  }

  const parentPath = path.slice(0, -1);
  let targetSiblingChildIndex = 0;

  const transformList = (list: readonly FieldOption[]): FieldOption[] => {
    const moving = list[leafIndex];
    const prevSibling = list[leafIndex - 1];

    if (moving === undefined || prevSibling === undefined) {
      return [...list];
    }

    const nextChildren = [...prevSibling.children ?? [], moving];

    targetSiblingChildIndex = nextChildren.length - 1;

    return list.flatMap((item, index) => {
      if (index === leafIndex) {
        return [];
      }

      if (index === leafIndex - 1) {
        return [{ ...item, children: nextChildren }];
      }

      return [item];
    });
  };

  const nextOptions = parentPath.length === 0
    ? transformList(options)
    : updateOptionAtPath(options, parentPath, parent => withNormalizedChildren(parent, transformList(parent.children ?? [])));

  return {
    options: nextOptions,
    nextPath: [...parentPath, leafIndex - 1, targetSiblingChildIndex]
  };
}

/**
 * Promote (outdent) the option at `path` so it becomes the immediate next
 * sibling of its current parent. Returns `null` when the node is already at
 * root depth.
 */
export function outdentOptionAtPath(
  options: readonly FieldOption[],
  path: OptionTreePath
): { options: FieldOption[]; nextPath: number[] } | null {
  if (path.length < 2) {
    return null;
  }

  const childIndex = path.at(-1)!;
  const parentIndex = path.at(-2)!;
  const grandParentPath = path.slice(0, -2);

  const transformGrandList = (list: readonly FieldOption[]): FieldOption[] => {
    const parent = list[parentIndex];
    const moving = parent?.children?.[childIndex];

    if (parent === undefined || moving === undefined) {
      return [...list];
    }

    const remainingChildren = (parent.children ?? []).filter((_item, index) => index !== childIndex);
    const updatedParent = withNormalizedChildren(parent, remainingChildren);

    return list.flatMap((item, index) => index === parentIndex ? [updatedParent, moving] : [item]);
  };

  const nextOptions = grandParentPath.length === 0
    ? transformGrandList(options)
    : updateOptionAtPath(options, grandParentPath, gp => withNormalizedChildren(gp, transformGrandList(gp.children ?? [])));

  return {
    options: nextOptions,
    nextPath: [...grandParentPath, parentIndex + 1]
  };
}

/**
 * Move an option up (`-1`) or down (`1`) among its siblings at the same parent.
 */
export function moveOptionSiblingAtPath(
  options: readonly FieldOption[],
  path: OptionTreePath,
  direction: -1 | 1
): { options: FieldOption[]; nextPath: number[] } | null {
  const leafIndex = path.at(-1);

  if (leafIndex === undefined) {
    return null;
  }

  const targetIndex = leafIndex + direction;

  if (targetIndex < 0) {
    return null;
  }

  const parentPath = path.slice(0, -1);
  let moved = false;

  const swapInList = (list: readonly FieldOption[]): FieldOption[] => {
    if (targetIndex >= list.length) {
      return [...list];
    }

    const next = [...list];
    const current = next[leafIndex];
    const neighbor = next[targetIndex];

    if (current === undefined || neighbor === undefined) {
      return next;
    }

    next[leafIndex] = neighbor;
    next[targetIndex] = current;
    moved = true;

    return next;
  };

  const nextOptions = parentPath.length === 0
    ? swapInList(options)
    : updateOptionAtPath(options, parentPath, parent => withNormalizedChildren(parent, swapInList(parent.children ?? [])));

  return moved ? { options: nextOptions, nextPath: [...parentPath, targetIndex] } : null;
}

let optionRowIdCounter = 0;

/**
 * Mint an ephemeral row id. UI-only — keys editor rows while the list is being
 * edited and is never persisted into the schema.
 */
function nextOptionRowId(): string {
  optionRowIdCounter += 1;

  return `option-row-${optionRowIdCounter}`;
}

/**
 * Reorder an option list from a sortable drag. Drives off the UI-only row-id
 * array (the sortable item ids) so `moveDragItem` stays type-safe, then permutes
 * the options into the same order — the two lockstep arrays can never drift.
 * Returns `null` for a no-op (cancel / dropped in place), which the caller uses
 * to skip an empty commit. Exported so the reorder can be unit-tested with a
 * fabricated drag event, the same way the canvas drag-end handler is.
 */
export function reorderOptionRows(
  options: FieldOption[],
  rowIds: string[],
  event: DragEndEvent
): { options: FieldOption[]; rowIds: string[] } | null {
  const nextIds = moveDragItem(rowIds, event);

  if (nextIds === rowIds) {
    return null;
  }

  const optionByRowId = new Map(rowIds.map((rowId, index) => [rowId, options[index]] as const));
  const nextOptions = nextIds
    .map(rowId => optionByRowId.get(rowId))
    .filter((option): option is FieldOption => option !== undefined);

  return { options: nextOptions, rowIds: nextIds };
}

function OptionDetailFields({
  onChange,
  option
}: {
  option: FieldOption;
  onChange: (patch: Partial<FieldOption>) => void;
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

interface OptionRowProps {
  id: string;
  index: number;
  option: FieldOption;
  duplicated: boolean;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onPatch: (patch: Partial<FieldOption>) => void;
  onRemove: () => void;
}

/**
 * One sortable flat option row: a drag grip, the label/value inputs, an
 * optional expandable detail toggle (description / disabled), and a delete
 * button.
 */
function OptionRow({
  detailsOpen,
  duplicated,
  id,
  index,
  onPatch,
  onRemove,
  onToggleDetails,
  option
}: OptionRowProps): ReactElement {
  const {
    handleRef,
    isDragging,
    ref
  } = useSortable({ id, index });
  const hasDetailMeta = option.disabled === true || (option.description !== undefined && option.description.length > 0);

  return (
    <div ref={ref} css={[flatItemCss, isDragging && optionRowDraggingCss]}>
      <div css={optionRowCss}>
        <span
          ref={handleRef}
          aria-label="拖动排序"
          css={dragHandleCss}
          role="button"
          tabIndex={0}
          title="拖动排序"
        >
          <EditorIcon name="grip-vertical" />
        </span>

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
          type="text"
          onClick={onRemove}
        />
      </div>

      {detailsOpen ? <OptionDetailFields option={option} onChange={onPatch} /> : null}
    </div>
  );
}

interface FlattenedTreeItem {
  option: FieldOption;
  path: number[];
  pathKey: string;
  depth: number;
  siblingIndex: number;
  siblingCount: number;
  hasChildren: boolean;
  collapsed: boolean;
}

function flattenEditableTree(
  options: readonly FieldOption[],
  collapsedPaths: ReadonlySet<string>,
  parentPath: readonly number[] = []
): FlattenedTreeItem[] {
  const out: FlattenedTreeItem[] = [];

  for (const [index, option] of options.entries()) {
    const path = [...parentPath, index];
    const pathKey = path.join(".");
    const hasChildren = hasOptionChildren(option);
    const collapsed = hasChildren && collapsedPaths.has(pathKey);

    out.push({
      option,
      path,
      pathKey,
      depth: parentPath.length,
      siblingIndex: index,
      siblingCount: options.length,
      hasChildren,
      collapsed
    });

    if (hasChildren && !collapsed) {
      out.push(...flattenEditableTree(option.children!, collapsedPaths, path));
    }
  }

  return out;
}

/**
 * Inline editor for a static option list or tree. Shared by the field
 * option-source entry, the fixed-row subform source editor, and the form-global
 * data-source modal so row layout, duplicate-value detection, metadata
 * (`disabled` / `description`), hierarchy operations, and bulk paste live in
 * one place.
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
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());

  if (!allowHierarchy && rowIdsRef.current.length !== options.length) {
    rowIdsRef.current = options.map(() => nextOptionRowId());
  }

  const rowIds = rowIdsRef.current;
  const duplicated = findDuplicateOptionValues(options);
  const bulkPasteEnabled = allowBulkPaste || allowHierarchy;

  const toggleDetails = (key: string): void => {
    setOpenDetails(prev => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const toggleCollapsed = (pathKey: string): void => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);

      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }

      return next;
    });
  };

  const setFlatRow = (index: number, patch: Partial<FieldOption>): void => {
    onChange(options.map((option, current) => current === index ? patchOptionMetadata(option, patch) : option));
  };

  const removeFlatRow = (index: number): void => {
    rowIdsRef.current = rowIds.filter((_id, current) => current !== index);
    onChange(options.filter((_option, current) => current !== index));
  };

  const addRootRow = (): void => {
    if (!allowHierarchy) {
      rowIdsRef.current = [...rowIds, nextOptionRowId()];
    }

    onChange([...options, { label: "", value: "" }]);
  };

  const applyBulkPaste = (mode: "append" | "replace"): void => {
    const existingValues = mode === "append" ? collectOptionValues(options) : new Set<string>();
    const parsed = allowHierarchy
      ? parseIndentedOptionLines(bulkText, existingValues)
      : parseBulkOptionLines(bulkText, existingValues);

    if (parsed.length === 0) {
      setBulkOpen(false);
      setBulkText("");
      return;
    }

    const next = mode === "append" ? [...options, ...parsed] : parsed;

    if (!allowHierarchy) {
      rowIdsRef.current = next.map(() => nextOptionRowId());
    } else if (mode === "replace") {
      setCollapsedPaths(new Set());
    }

    onChange(next);
    setBulkOpen(false);
    setBulkText("");
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    // History coalesces per property entry, so the reorder is one undoable step.
    const result = reorderOptionRows(options, rowIds, event);

    if (result === null) {
      return;
    }

    rowIdsRef.current = result.rowIds;
    onChange(result.options);
  };

  const treeItems = allowHierarchy ? flattenEditableTree(options, collapsedPaths) : [];

  return (
    <div css={rootCss}>
      {options.length === 0 ? <span css={emptyCss}>暂无选项</span> : null}

      {allowHierarchy
        ? treeItems.map(item => {
            const {
              collapsed,
              depth,
              hasChildren,
              option,
              path,
              pathKey,
              siblingCount,
              siblingIndex
            } = item;
            const detailsOpen = openDetails.has(pathKey);
            const hasDetailMeta = option.disabled === true
              || (option.description !== undefined && option.description.length > 0);
            const indentPx = Math.min(depth, 6) * 14;

            return (
              <div
                key={pathKey}
                css={[treeRowContainerCss, depth > 0 && treeRowNestedCss]}
                style={indentPx > 0 ? { marginLeft: indentPx } : undefined}
              >
                <div css={treeRowHeaderCss}>
                  <div css={treeInputsGroupCss}>
                    {hasChildren
                      ? (
                          <Button
                            aria-expanded={!collapsed}
                            aria-label={collapsed ? "展开子项" : "折叠子项"}
                            css={iconButtonCss}
                            icon={<EditorIcon name={collapsed ? "chevron-right" : "chevron-down"} />}
                            size="small"
                            title={collapsed ? "展开子项" : "折叠子项"}
                            type="text"
                            onClick={() => toggleCollapsed(pathKey)}
                          />
                        )
                      : <span aria-hidden css={foldSpacerCss} />}

                    <Input
                      placeholder="标签"
                      value={option.label}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(
                        updateOptionAtPath(options, path, current => patchOptionMetadata(current, { label: event.target.value }))
                      )}
                    />

                    <Input
                      placeholder="值"
                      status={duplicated.includes(String(option.value)) ? "warning" : undefined}
                      value={String(option.value)}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(
                        updateOptionAtPath(options, path, current => patchOptionMetadata(current, { value: event.target.value }))
                      )}
                    />
                  </div>

                  <div css={treeActionsCss}>
                    <Button
                      aria-label="添加子项"
                      css={iconButtonCss}
                      icon={<EditorIcon name="corner-down-right" />}
                      size="small"
                      title="添加子项"
                      type="text"
                      onClick={() => {
                        setCollapsedPaths(prev => {
                          if (!prev.has(pathKey)) {
                            return prev;
                          }

                          const next = new Set(prev);
                          next.delete(pathKey);
                          return next;
                        });
                        onChange(addChildOptionAtPath(options, path));
                      }}
                    />

                    <Button
                      aria-label="升级"
                      css={iconButtonCss}
                      disabled={depth === 0}
                      icon={<EditorIcon name="indent-decrease" />}
                      size="small"
                      title="升级为上级同级项"
                      type="text"
                      onClick={() => {
                        const result = outdentOptionAtPath(options, path);

                        if (result !== null) {
                          onChange(result.options);
                        }
                      }}
                    />

                    <Button
                      aria-label="降级"
                      css={iconButtonCss}
                      disabled={siblingIndex === 0}
                      icon={<EditorIcon name="indent-increase" />}
                      size="small"
                      title="降级为前一项的子项"
                      type="text"
                      onClick={() => {
                        const result = indentOptionAtPath(options, path);

                        if (result !== null) {
                          const parentKey = result.nextPath.slice(0, -1).join(".");

                          setCollapsedPaths(prev => {
                            if (!prev.has(parentKey)) {
                              return prev;
                            }

                            const next = new Set(prev);
                            next.delete(parentKey);
                            return next;
                          });
                          onChange(result.options);
                        }
                      }}
                    />

                    <Button
                      aria-label="上移"
                      css={iconButtonCss}
                      disabled={siblingIndex === 0}
                      icon={<EditorIcon name="chevron-up" />}
                      size="small"
                      title="同级上移"
                      type="text"
                      onClick={() => {
                        const result = moveOptionSiblingAtPath(options, path, -1);

                        if (result !== null) {
                          onChange(result.options);
                        }
                      }}
                    />

                    <Button
                      aria-label="下移"
                      css={iconButtonCss}
                      disabled={siblingIndex >= siblingCount - 1}
                      icon={<EditorIcon name="chevron-down" />}
                      size="small"
                      title="同级下移"
                      type="text"
                      onClick={() => {
                        const result = moveOptionSiblingAtPath(options, path, 1);

                        if (result !== null) {
                          onChange(result.options);
                        }
                      }}
                    />

                    <Button
                      aria-expanded={detailsOpen}
                      aria-label="选项详情"
                      css={[iconButtonCss, (detailsOpen || hasDetailMeta) && detailToggleActiveCss]}
                      icon={<EditorIcon name="sliders-horizontal" />}
                      size="small"
                      title="描述与禁用"
                      type="text"
                      onClick={() => toggleDetails(pathKey)}
                    />

                    <Button
                      aria-label="删除选项"
                      css={iconButtonCss}
                      icon={<EditorIcon name="trash-2" />}
                      size="small"
                      title="删除选项"
                      type="text"
                      onClick={() => onChange(removeOptionAtPath(options, path))}
                    />
                  </div>
                </div>

                {detailsOpen
                  ? (
                      <OptionDetailFields
                        option={option}
                        onChange={patch => onChange(
                          updateOptionAtPath(options, path, current => patchOptionMetadata(current, patch))
                        )}
                      />
                    )
                  : null}
              </div>
            );
          })

        : (
            // Scoped to its own DragDropProvider so an option-row drag never routes
            // into the editor canvas's drag context (the properties panel renders
            // inside the canvas provider). Restricted to the vertical axis, as a
            // plain reorderable list.
            <DragDropProvider modifiers={[RestrictToVerticalAxis]} onDragEnd={handleDragEnd}>
              {options.map((option, index) => {
                const id = rowIds[index];

                // rowIds is kept in lockstep with options (synced at the top of the
                // component), so an id is always present here — the guard just
                // satisfies the index access under `noUncheckedIndexedAccess`.
                if (id === undefined) {
                  return null;
                }

                return (
                  <OptionRow
                    key={id}
                    detailsOpen={openDetails.has(id)}
                    duplicated={duplicated.includes(String(option.value))}
                    id={id}
                    index={index}
                    option={option}
                    onPatch={patch => setFlatRow(index, patch)}
                    onRemove={() => removeFlatRow(index)}
                    onToggleDetails={() => toggleDetails(id)}
                  />
                );
              })}
            </DragDropProvider>
          )}

      {duplicated.length > 0
        ? <span css={duplicateWarningCss}>{`选项值重复：${duplicated.join("、")}`}</span>
        : null}

      {bulkOpen
        ? (
            <div css={bulkPanelCss}>
              <span css={bulkHintCss}>
                {allowHierarchy
                  ? "每行一项，用空格或 Tab 缩进表示层级；空行自动忽略，系统将自动生成唯一值"
                  : "每行一项，空行自动忽略；系统将自动生成唯一值"}
              </span>

              <Input.TextArea
                aria-label="批量粘贴行项目"
                autoSize={{ minRows: 4, maxRows: 10 }}
                value={bulkText}
                placeholder={allowHierarchy
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

                {options.length > 0
                  ? (
                      <Button size="small" onClick={() => applyBulkPaste("append")}>
                        追加
                      </Button>
                    )
                  : null}

                <Button size="small" type="primary" onClick={() => applyBulkPaste("replace")}>
                  {options.length > 0 ? "替换全部" : "导入"}
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
