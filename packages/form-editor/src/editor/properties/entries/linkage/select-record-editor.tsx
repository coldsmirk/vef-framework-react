import type { DropdownMenuItem } from "@vef-framework-react/components";
import type { DragEndEvent } from "@vef-framework-react/core";
import type { ChangeEvent, ReactElement } from "react";

import type { FieldLinkageAction, KeyedFormField, SelectRecordColumn, SelectRecordWhenNone } from "../../../../types";
import type { OptionItem } from "./options";

import { css } from "@emotion/react";
import { Button, Dropdown, globalCssVars, Input, Select } from "@vef-framework-react/components";
import { DragDropProvider, moveDragItem, RestrictToVerticalAxis, useSortable } from "@vef-framework-react/core";
import { useMemo, useRef } from "react";

import { collectInferredSelectRecordColumns, resolveSelectRecordSourceFields } from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { useDataSourceApis } from "../../../data-source-apis";
import { DynamicValueEditor } from "../../dynamic-value-editor";
import { actionDeleteCss, selectStyle } from "./styles";

const sectionCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

const subHeaderCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap"
});

const subtitleCss = css({
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary
});

const hintBoxCss = css({
  padding: "8px 10px",
  borderRadius: globalCssVars.borderRadius,
  border: `1px dashed ${globalCssVars.colorBorderSecondary}`,
  background: globalCssVars.colorFillQuaternary,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorTextTertiary
});

const columnListCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6
});

const columnRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6
});

const columnDraggingCss = css({
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgElevated,
  boxShadow: globalCssVars.shadowLg
});

const dragHandleCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  flexShrink: 0,
  borderRadius: globalCssVars.borderRadiusSm,
  color: globalCssVars.colorTextTertiary,
  cursor: "grab",
  transition: `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}, background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

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

const actionsRowCss = css({
  display: "flex",
  gap: 6,
  flexWrap: "wrap"
});

const fieldGroupCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4
});

const fieldLabelCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

export const WHEN_NONE_OPTIONS: Array<OptionItem<SelectRecordWhenNone>> = [
  { value: "stop", label: "无匹配时终止后续动作" },
  { value: "continue", label: "无匹配时继续（结果为空）" }
];

const ADD_ALL_KEY = "__add_all__";
const EMPTY_COLUMNS: SelectRecordColumn[] = [];

let columnRowCounter = 0;

function nextColumnRowId(): string {
  columnRowCounter += 1;

  return `select-col-${columnRowCounter}`;
}

export function reorderSelectColumns(
  columns: SelectRecordColumn[],
  rowIds: string[],
  event: DragEndEvent
): { columns: SelectRecordColumn[]; rowIds: string[] } | null {
  const nextIds = moveDragItem(rowIds, event);

  if (nextIds === rowIds) {
    return null;
  }

  const byId = new Map(rowIds.map((id, index) => [id, columns[index]] as const));
  const nextColumns = nextIds
    .map(id => byId.get(id))
    .filter((item): item is SelectRecordColumn => item !== undefined);

  return { columns: nextColumns, rowIds: nextIds };
}

interface SortableColumnRowProps {
  id: string;
  index: number;
  column: SelectRecordColumn;
  canReorder: boolean;
  onChange: (next: SelectRecordColumn) => void;
  onRemove: () => void;
}

function SortableColumnRow({
  canReorder,
  column,
  id,
  index,
  onChange,
  onRemove
}: SortableColumnRowProps): ReactElement {
  const {
    handleRef,
    isDragging,
    ref
  } = useSortable({ id, index });

  return (
    <div ref={ref} css={[columnRowCss, isDragging && columnDraggingCss]}>
      {canReorder
        ? (
            <span
              ref={handleRef}
              aria-label="拖动列排序"
              css={dragHandleCss}
              role="button"
              tabIndex={0}
              title="拖动排序"
            >
              <EditorIcon name="grip-vertical" />
            </span>
          )
        : null}

      <Input
        aria-label="列标题"
        placeholder="列标题"
        value={column.label}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...column, label: event.target.value })}
      />

      <Input
        aria-label="字段路径"
        placeholder="字段路径，如 name"
        value={column.path}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...column, path: event.target.value })}
      />

      <Button
        aria-label="删除展示列"
        css={actionDeleteCss}
        icon={<EditorIcon name="x" />}
        size="small"
        type="text"
        onClick={onRemove}
      />
    </div>
  );
}

export interface SelectRecordColumnsEditorProps {
  columns: SelectRecordColumn[] | undefined;
  actionIndex: number;
  allActions: readonly FieldLinkageAction[];
  outputName: string;
  scopeFieldsByKey: ReadonlyMap<string, KeyedFormField>;
  onChange: (columns: SelectRecordColumn[] | undefined) => void;
}

/**
 * Configures the display columns of `select_record`: pick from the source
 * step's declared `fields`, rename titles, drag-sort, or leave empty to
 * auto-infer from downstream `set_fields` bindings (with a live preview of the
 * inferred columns).
 */
export function SelectRecordColumnsEditor({
  actionIndex,
  allActions,
  columns,
  onChange,
  outputName,
  scopeFieldsByKey
}: SelectRecordColumnsEditorProps): ReactElement {
  const apis = useDataSourceApis();
  const list = columns ?? EMPTY_COLUMNS;
  const rowIdsRef = useRef<string[]>([]);

  if (rowIdsRef.current.length !== list.length) {
    rowIdsRef.current = list.map(() => nextColumnRowId());
  }

  const rowIds = rowIdsRef.current;

  const sourceFields = useMemo(
    () => resolveSelectRecordSourceFields(allActions, actionIndex, apis),
    [allActions, actionIndex, apis]
  );

  const usedPaths = useMemo(
    () => new Set(list.map(col => col.path.trim()).filter(path => path.length > 0)),
    [list]
  );

  const availableSourceFields = useMemo(
    () => sourceFields.filter(field => !usedPaths.has(field.path)),
    [sourceFields, usedPaths]
  );

  const inferredColumns = useMemo(
    () => list.length > 0
      ? []
      : collectInferredSelectRecordColumns(outputName, allActions.slice(actionIndex + 1), scopeFieldsByKey),
    [list.length, outputName, allActions, actionIndex, scopeFieldsByKey]
  );

  const commit = (next: SelectRecordColumn[]): void => {
    onChange(next.length > 0 ? next : undefined);
  };

  const updateAt = (index: number, next: SelectRecordColumn): void => {
    commit(list.map((col, current) => current === index ? next : col));
  };

  const removeAt = (index: number): void => {
    rowIdsRef.current = rowIds.filter((_id, current) => current !== index);
    commit(list.filter((_col, current) => current !== index));
  };

  const addCustom = (): void => {
    rowIdsRef.current = [...rowIds, nextColumnRowId()];
    commit([...list, { label: "", path: "" }]);
  };

  const addFromSourceField = (path: string, label: string): void => {
    rowIdsRef.current = [...rowIds, nextColumnRowId()];
    commit([...list, { label, path }]);
  };

  const addAllSourceFields = (): void => {
    if (availableSourceFields.length === 0) {
      return;
    }

    const appended = availableSourceFields.map(field => {
      return { label: field.label, path: field.path };
    });

    rowIdsRef.current = [...rowIds, ...appended.map(() => nextColumnRowId())];
    commit([...list, ...appended]);
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const result = reorderSelectColumns(list, rowIds, event);

    if (result === null) {
      return;
    }

    rowIdsRef.current = result.rowIds;
    commit(result.columns);
  };

  const sourceMenuItems: DropdownMenuItem[] = [
    ...availableSourceFields.length > 1
      ? [
          {
            key: ADD_ALL_KEY,
            label: `添加全部来源字段（${availableSourceFields.length} 项）`
          },
          { type: "divider" as const }
        ]
      : [],
    ...availableSourceFields.map(field => {
      return {
        key: field.path,
        label: `${field.label}（${field.path}）`
      };
    })
  ];

  return (
    <div css={sectionCss}>
      <div css={subHeaderCss}>
        <span css={subtitleCss}>弹窗展示列（可选）</span>

        {list.length > 0
          ? (
              <Button
                size="small"
                type="text"
                onClick={() => {
                  rowIdsRef.current = [];
                  onChange(undefined);
                }}
              >
                恢复自动推断
              </Button>
            )
          : null}
      </div>

      {list.length === 0
        ? (
            <div css={hintBoxCss}>
              {inferredColumns.length > 0
                ? `当前留空，多条记录时将自动展示后续写入引用的列：${inferredColumns.map(col => col.label).join("、")}`
                : "当前留空，运行时将自动展示后续「设置字段」引用的列；若无引用则自动展示记录的前几个文本字段。"}
            </div>
          )
        : (
            <DragDropProvider modifiers={[RestrictToVerticalAxis]} onDragEnd={handleDragEnd}>
              <div css={columnListCss}>
                {list.map((column, index) => {
                  const id = rowIds[index];

                  if (id === undefined) {
                    return null;
                  }

                  return (
                    <SortableColumnRow
                      key={id}
                      canReorder={list.length > 1}
                      column={column}
                      id={id}
                      index={index}
                      onChange={next => updateAt(index, next)}
                      onRemove={() => removeAt(index)}
                    />
                  );
                })}
              </div>
            </DragDropProvider>
          )}

      <div css={actionsRowCss}>
        {availableSourceFields.length > 0
          ? (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: sourceMenuItems,
                  onClick: event => {
                    if (event.key === ADD_ALL_KEY) {
                      addAllSourceFields();
                      return;
                    }

                    const field = availableSourceFields.find(item => item.path === event.key);

                    if (field !== undefined) {
                      addFromSourceField(field.path, field.label);
                    }
                  }
                }}
              >
                <Button icon={<EditorIcon name="plus" />} size="small" type="dashed">
                  从来源字段添加
                </Button>
              </Dropdown>
            )
          : null}

        <Button icon={<EditorIcon name="plus" />} size="small" type="dashed" onClick={addCustom}>
          添加自定义列
        </Button>
      </div>
    </div>
  );
}

export interface SelectRecordEditorProps {
  action: Extract<FieldLinkageAction, { type: "select_record" }>;
  actionIndex: number;
  allActions: readonly FieldLinkageAction[];
  scopeFieldsByKey: ReadonlyMap<string, KeyedFormField>;
  /**
   * Slot for the output-name control (inline buffered input in the right panel,
   * or a `DraftField` in the wide modal).
   */
  outputControl: ReactElement;
  onChange: (next: Extract<FieldLinkageAction, { type: "select_record" }>) => void;
}

/**
 * Body fields for a `select_record` action, shared by the right panel and the
 * wide action modal.
 */
export function SelectRecordEditor({
  action,
  actionIndex,
  allActions,
  onChange,
  outputControl,
  scopeFieldsByKey
}: SelectRecordEditorProps): ReactElement {
  const effectiveActions = useMemo(
    () => allActions.map((item, idx) => idx === actionIndex ? action : item),
    [allActions, actionIndex, action]
  );

  return (
    <div css={sectionCss}>
      <div css={fieldGroupCss}>
        <span css={fieldLabelCss}>数据来源</span>

        <DynamicValueEditor
          preferSteps
          expressionPlaceholder="自定义表达式"
          literalPlaceholder="来源数据"
          referencePlaceholder="选择来源步骤或字段"
          value={action.source}
          onChange={source => onChange({ ...action, source })}
        />
      </div>

      {outputControl}

      <SelectRecordColumnsEditor
        actionIndex={actionIndex}
        allActions={effectiveActions}
        columns={action.columns}
        outputName={action.output}
        scopeFieldsByKey={scopeFieldsByKey}
        onChange={columns => {
          if (columns === undefined) {
            const next = { ...action };
            delete next.columns;
            onChange(next);
            return;
          }

          onChange({ ...action, columns });
        }}
      />

      <div css={fieldGroupCss}>
        <span css={fieldLabelCss}>无匹配时</span>

        <Select
          options={WHEN_NONE_OPTIONS}
          style={selectStyle}
          value={action.whenNone ?? "stop"}
          onChange={value => {
            if (value === "continue") {
              onChange({ ...action, whenNone: "continue" });
              return;
            }

            const next = { ...action };
            delete next.whenNone;
            onChange(next);
          }}
        />
      </div>

      <div css={fieldGroupCss}>
        <span css={fieldLabelCss}>弹窗标题（可选）</span>

        <Input
          placeholder="如：选择职员"
          value={action.title ?? ""}
          onChange={event => {
            const title = event.target.value;

            if (title.length === 0) {
              const next = { ...action };
              delete next.title;
              onChange(next);
              return;
            }

            onChange({ ...action, title });
          }}
        />
      </div>

      <div css={fieldGroupCss}>
        <span css={fieldLabelCss}>无匹配提示（可选）</span>

        <Input
          placeholder="如：未查到对应记录"
          value={action.emptyMessage ?? ""}
          onChange={event => {
            const emptyMessage = event.target.value;

            if (emptyMessage.length === 0) {
              const next = { ...action };
              delete next.emptyMessage;
              onChange(next);
              return;
            }

            onChange({ ...action, emptyMessage });
          }}
        />
      </div>
    </div>
  );
}
