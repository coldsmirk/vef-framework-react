import type { DropdownMenuItem } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { FieldLinkageAction, KeyedFormField, SelectRecordColumn, SelectRecordWhenNone } from "../../../../types";
import type { OptionItem } from "./options";

import { css } from "@emotion/react";
import { Button, Dropdown, globalCssVars, Input, Select } from "@vef-framework-react/components";
import { DragDropProvider, RestrictToVerticalAxis, useSortable } from "@vef-framework-react/core";
import { useId, useMemo } from "react";

import { collectInferredSelectRecordColumns, resolveRecordSourceFields } from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { DraftField } from "../../draft-modal";
import { DynamicValueEditor } from "../../dynamic-value-editor";
import { useReferenceScope } from "../../reference-scope";
import { draggingRowCss, DragHandle, useSortableRows } from "../../sortable-rows";
import { withOptional } from "./mutators";
import { actionDeleteCss, selectStyle } from "./styles";

const sectionCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

const fieldsCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 12
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

const actionsRowCss = css({
  display: "flex",
  gap: 6,
  flexWrap: "wrap"
});

const WHEN_NONE_OPTIONS: Array<OptionItem<SelectRecordWhenNone>> = [
  { value: "stop", label: "无匹配时终止后续动作" },
  { value: "continue", label: "无匹配时继续（结果为空）" }
];

const ADD_ALL_KEY = "__add_all__";
const NO_COLUMNS: SelectRecordColumn[] = [];
const BLANK_COLUMN: SelectRecordColumn = { label: "", path: "" };

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
    <div ref={ref} css={[columnRowCss, isDragging && draggingRowCss]}>
      {canReorder ? <DragHandle handleRef={handleRef} label="拖动列排序" /> : null}

      <Input
        aria-label="列标题"
        placeholder="列标题"
        value={column.label}
        onChange={event => onChange({ ...column, label: event.target.value })}
      />

      <Input
        aria-label="字段路径"
        placeholder="字段路径，如 name"
        value={column.path}
        onChange={event => onChange({ ...column, path: event.target.value })}
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

type SelectRecordAction = Extract<FieldLinkageAction, { type: "select_record" }>;

interface SelectRecordColumnsEditorProps {
  action: SelectRecordAction;
  laterActions: readonly FieldLinkageAction[];
  fieldsByKey: ReadonlyMap<string, KeyedFormField>;
  onChange: (columns: SelectRecordColumn[] | undefined) => void;
}

/**
 * The columns the picker shows: chosen from the source's declared fields or
 * typed, and left out to follow what the later steps read.
 */
function SelectRecordColumnsEditor({
  action,
  fieldsByKey,
  laterActions,
  onChange
}: SelectRecordColumnsEditorProps): ReactElement {
  const { priorSteps = [] } = useReferenceScope();
  const list = action.columns ?? NO_COLUMNS;
  const rows = useSortableRows(list, next => onChange(next.length > 0 ? next : undefined));

  const sourceFields = resolveRecordSourceFields(action.source, priorSteps);
  const availableSourceFields = sourceFields.filter(field => list.every(column => column.path.trim() !== field.path));
  const inferredColumns = useMemo(
    () => collectInferredSelectRecordColumns(action.output, laterActions, fieldsByKey),
    [action.output, laterActions, fieldsByKey]
  );

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
              <Button size="small" type="text" onClick={() => rows.replaceAll([])}>
                恢复自动推断
              </Button>
            )
          : null}
      </div>

      {list.length === 0
        ? (
            <div css={hintBoxCss}>
              {inferredColumns.length > 0
                ? `留空时展示后续步骤引用的列：${inferredColumns.map(column => column.label).join("、")}`
                : "留空时展示后续「设置字段」引用的列；没有引用时，展示记录中的文本、数字和是否字段"}
            </div>
          )
        : (
            <DragDropProvider modifiers={[RestrictToVerticalAxis]} onDragEnd={rows.handleDragEnd}>
              <div css={columnListCss}>
                {list.map((column, index) => {
                  const id = rows.ids[index];

                  return id === undefined
                    ? null
                    : (
                        <SortableColumnRow
                          key={id}
                          canReorder={list.length > 1}
                          column={column}
                          id={id}
                          index={index}
                          onChange={next => rows.update(index, next)}
                          onRemove={() => rows.remove(index)}
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
                    rows.append(availableSourceFields
                      .filter(field => event.key === ADD_ALL_KEY || event.key === field.path)
                      .map(field => {
                        return { label: field.label, path: field.path };
                      }));
                  }
                }}
              >
                <Button icon={<EditorIcon name="plus" />} size="small" type="dashed">
                  从来源字段添加
                </Button>
              </Dropdown>
            )
          : null}

        <Button icon={<EditorIcon name="plus" />} size="small" type="dashed" onClick={() => rows.append([BLANK_COLUMN])}>
          添加自定义列
        </Button>
      </div>
    </div>
  );
}

export interface SelectRecordEditorProps {
  action: SelectRecordAction;
  laterActions: readonly FieldLinkageAction[];
  fieldsByKey: ReadonlyMap<string, KeyedFormField>;
  /**
   * The output-name control, which names differently inline and in a draft.
   */
  outputControl: ReactElement;
  onChange: (next: SelectRecordAction) => void;
}

/**
 * Body of a `select_record` step, shared by the side panel and the modal.
 */
export function SelectRecordEditor({
  action,
  fieldsByKey,
  laterActions,
  onChange,
  outputControl
}: SelectRecordEditorProps): ReactElement {
  const titleId = useId();
  const emptyMessageId = useId();

  return (
    <div css={fieldsCss}>
      <DraftField label="数据来源">
        <DynamicValueEditor
          expressionPlaceholder="自定义表达式"
          literalPlaceholder="来源数据"
          referencePlaceholder="选择来源步骤或字段"
          value={action.source}
          onChange={source => onChange({ ...action, source })}
        />
      </DraftField>

      {outputControl}

      <SelectRecordColumnsEditor
        action={action}
        fieldsByKey={fieldsByKey}
        laterActions={laterActions}
        onChange={columns => onChange(withOptional(action, "columns", columns))}
      />

      <DraftField label="无匹配时">
        <Select
          aria-label="无匹配时"
          options={WHEN_NONE_OPTIONS}
          style={selectStyle}
          value={action.whenNone ?? "stop"}
          onChange={value => onChange(withOptional(action, "whenNone", value === "continue" ? "continue" : undefined))}
        />
      </DraftField>

      <DraftField htmlFor={titleId} label="弹窗标题（可选）">
        <Input
          id={titleId}
          placeholder="如：选择职员"
          value={action.title ?? ""}
          onChange={event => onChange(withOptional(action, "title", event.target.value || undefined))}
        />
      </DraftField>

      <DraftField htmlFor={emptyMessageId} label="无匹配提示（可选）">
        <Input
          id={emptyMessageId}
          placeholder="如：未查到对应记录"
          value={action.emptyMessage ?? ""}
          onChange={event => onChange(withOptional(action, "emptyMessage", event.target.value || undefined))}
        />
      </DraftField>
    </div>
  );
}
