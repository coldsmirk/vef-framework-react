import type { DropdownMenuItem, SelectProps } from "@vef-framework-react/components";
import type { DragEndEvent } from "@vef-framework-react/core";
import type { ReactElement } from "react";

import type { PriorStepSchema, WritableTargetField } from "../../../../engine/linkage";
import type { FieldAssignment, FormDataSource } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { css } from "@emotion/react";
import { Button, Dropdown, globalCssVars, Select } from "@vef-framework-react/components";
import { DragDropProvider, moveDragItem, RestrictToVerticalAxis, useSortable } from "@vef-framework-react/core";
import { useMemo, useRef, useState } from "react";

import { matchStepFieldsToTargets } from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { DynamicValueEditor } from "../../dynamic-value-editor";
import { defaultLiteralValueForField } from "../../typed-literal-input";
import { actionDeleteCss, addInlineButtonCss, selectStyle } from "./styles";

const rootCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  containerType: "inline-size"
});

const toolbarCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap"
});

const toolbarHintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const rowsCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

const rowCardCss = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "center",
  gap: 6,
  padding: 8,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgContainer,

  "@container (min-width: 500px)": {
    gridTemplateColumns: "204px auto minmax(0, 1fr)",
    gap: 8,
    padding: "6px 8px"
  }
});

const rowCardRemovableCss = css({
  gridTemplateColumns: "minmax(0, 1fr) auto",

  "@container (min-width: 500px)": {
    gridTemplateColumns: "204px auto minmax(0, 1fr) auto"
  }
});

const rowDraggingCss = css({
  background: globalCssVars.colorBgElevated,
  boxShadow: globalCssVars.shadowLg
});

const targetGroupCss = css({
  gridColumn: 1,
  gridRow: 1,
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0
});

const targetSelectWrapCss = css({
  flex: 1,
  minWidth: 0,
  overflow: "hidden"
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

const arrowCss = css({
  display: "none",
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,

  "@container (min-width: 500px)": {
    display: "inline-block",
    gridColumn: 2,
    gridRow: 1
  }
});

const valueCellCss = css({
  gridColumn: "1 / -1",
  gridRow: 2,
  minWidth: 0,

  "@container (min-width: 500px)": {
    gridColumn: 3,
    gridRow: 1
  }
});

const deleteButtonCss = css({
  gridColumn: 2,
  gridRow: 1,

  "@container (min-width: 500px)": {
    gridColumn: 4,
    gridRow: 1
  }
});

const warningTextCss = css({
  color: globalCssVars.colorWarningText
});

const statusCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorTextSecondary
});

const duplicateWarningCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorWarningText
});

let assignmentRowCounter = 0;

function nextAssignmentRowId(): string {
  assignmentRowCounter += 1;

  return `assignment-row-${assignmentRowCounter}`;
}

export function reorderAssignments(
  assignments: FieldAssignment[],
  rowIds: string[],
  event: DragEndEvent
): { assignments: FieldAssignment[]; rowIds: string[] } | null {
  const nextIds = moveDragItem(rowIds, event);

  if (nextIds === rowIds) {
    return null;
  }

  const byId = new Map(rowIds.map((id, index) => [id, assignments[index]] as const));
  const nextAssignments = nextIds
    .map(id => byId.get(id))
    .filter((item): item is FieldAssignment => item !== undefined);

  return { assignments: nextAssignments, rowIds: nextIds };
}

function isEmptyLiteralValue(value: FieldAssignment["value"]): boolean {
  return value.kind === "literal" && (value.value === "" || value.value === undefined);
}

interface SortableAssignmentRowProps {
  id: string;
  index: number;
  assignment: FieldAssignment;
  targetOptions: SourceFieldOption[];
  targetField: WritableTargetField | undefined;
  dataSources: readonly FormDataSource[];
  duplicated: boolean;
  canRemove: boolean;
  canReorder: boolean;
  onChange: (next: FieldAssignment) => void;
  onRemove: () => void;
  resolveTargetField: (key: string) => WritableTargetField | undefined;
}

function SortableAssignmentRow({
  assignment,
  canRemove,
  canReorder,
  dataSources,
  duplicated,
  id,
  index,
  onChange,
  onRemove,
  resolveTargetField,
  targetField,
  targetOptions
}: SortableAssignmentRowProps): ReactElement {
  const {
    handleRef,
    isDragging,
    ref
  } = useSortable({ id, index });

  const hasTarget = assignment.targetKey.length > 0;
  const targetUnresolved = hasTarget && targetOptions.every(option => option.value !== assignment.targetKey);
  const selectOptions: SelectProps["options"] = targetUnresolved
    ? [
        ...targetOptions,
        {
          value: assignment.targetKey,
          label: <span css={warningTextCss}>{`${assignment.targetKey}（未识别）`}</span>
        }
      ]
    : targetOptions;

  return (
    <div ref={ref} css={[rowCardCss, canRemove && rowCardRemovableCss, isDragging && rowDraggingCss]}>
      <div css={targetGroupCss}>
        {canReorder
          ? (
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
            )
          : null}

        <div css={targetSelectWrapCss}>
          <Select
            aria-label="目标字段"
            options={selectOptions}
            placeholder="选择目标字段"
            popupMatchSelectWidth={220}
            showSearch={{ optionFilterProp: ["label"] }}
            status={duplicated || targetUnresolved ? "warning" : undefined}
            style={selectStyle}
            value={hasTarget ? assignment.targetKey : undefined}
            onChange={value => {
              const nextKey = String(value);
              const nextField = resolveTargetField(nextKey);
              const nextValue = isEmptyLiteralValue(assignment.value)
                ? { kind: "literal" as const, value: defaultLiteralValueForField(nextField) }
                : assignment.value;

              onChange({
                ...assignment,
                targetKey: nextKey,
                value: nextValue
              });
            }}
          />
        </div>
      </div>

      <span aria-hidden css={arrowCss}>←</span>

      <div css={valueCellCss}>
        <DynamicValueEditor
          preferSteps
          dataSources={dataSources}
          expressionPlaceholder="field.A"
          literalPlaceholder="写入的值"
          referencePlaceholder="选择来源字段或步骤"
          targetField={targetField}
          value={assignment.value}
          onChange={value => onChange({ ...assignment, value })}
        />
      </div>

      {canRemove
        ? (
            <Button
              aria-label="删除字段赋值"
              css={[actionDeleteCss, deleteButtonCss]}
              icon={<EditorIcon name="x" />}
              size="small"
              type="text"
              onClick={onRemove}
            />
          )
        : null}
    </div>
  );
}

export interface SetFieldsEditorProps {
  assignments: FieldAssignment[];
  targetOptions: SourceFieldOption[];
  writableTargets: readonly WritableTargetField[];
  priorSteps: readonly PriorStepSchema[];
  dataSources: readonly FormDataSource[];
  onChange: (assignments: FieldAssignment[]) => void;
}

/**
 * Compact, drag-sortable mapping table for `set_fields`:
 * - target field ← typed literal / grouped reference / expression
 * - "按名称匹配" matches declared fields from an earlier step against unmapped
 * same-scope writable controls (key first, then trimmed label) and appends
 * only unmapped targets.
 */
export function SetFieldsEditor({
  assignments,
  dataSources,
  onChange,
  priorSteps,
  targetOptions,
  writableTargets
}: SetFieldsEditorProps): ReactElement {
  const rowIdsRef = useRef<string[]>([]);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);

  if (rowIdsRef.current.length !== assignments.length) {
    rowIdsRef.current = assignments.map(() => nextAssignmentRowId());
  }

  const rowIds = rowIdsRef.current;

  const targetByKey = useMemo(() => {
    const map = new Map<string, WritableTargetField>();

    for (const field of writableTargets) {
      map.set(field.key, field);
    }

    return map;
  }, [writableTargets]);

  const duplicatedKeys = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();

    for (const item of assignments) {
      if (item.targetKey.length === 0) {
        continue;
      }

      if (seen.has(item.targetKey)) {
        dupes.add(item.targetKey);
      } else {
        seen.add(item.targetKey);
      }
    }

    return dupes;
  }, [assignments]);

  // Prefer the closest preceding step declaring fields (e.g. `select_record`
  // right before `set_fields` comes ahead of its upstream `api_call`).
  const matchableSteps = useMemo(
    () => priorSteps.filter(step => step.fields.length > 0).toReversed(),
    [priorSteps]
  );

  const runMatch = (step: PriorStepSchema): void => {
    const result = matchStepFieldsToTargets(step, writableTargets, assignments);

    if (result.added.length === 0) {
      setMatchStatus("没有可自动匹配的新字段（同名字段已全部映射或无同名项）");
      return;
    }

    rowIdsRef.current = result.nextAssignments.map(() => nextAssignmentRowId());
    onChange(result.nextAssignments);
    setMatchStatus(`已按名称匹配并新增 ${result.added.length} 项写入`);
  };

  const updateAt = (index: number, next: FieldAssignment): void => {
    setMatchStatus(null);
    onChange(assignments.map((item, current) => current === index ? next : item));
  };

  const removeAt = (index: number): void => {
    setMatchStatus(null);
    rowIdsRef.current = rowIds.filter((_id, current) => current !== index);
    onChange(assignments.filter((_item, current) => current !== index));
  };

  const addRow = (): void => {
    setMatchStatus(null);
    rowIdsRef.current = [...rowIds, nextAssignmentRowId()];
    onChange([...assignments, { targetKey: "", value: { kind: "literal", value: "" } }]);
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const result = reorderAssignments(assignments, rowIds, event);

    if (result === null) {
      return;
    }

    rowIdsRef.current = result.rowIds;
    onChange(result.assignments);
  };

  const matchDropdownItems: DropdownMenuItem[] = matchableSteps.map(step => {
    return {
      key: `${step.index}:${step.output}`,
      label: `步骤 ${step.index + 1} · ${step.label}（${step.output}）`
    };
  });

  return (
    <div css={rootCss}>
      {matchableSteps.length > 0
        ? (
            <div css={toolbarCss}>
              <span css={toolbarHintCss}>可按字段标识或名称自动匹配前序步骤结果</span>

              {matchableSteps.length === 1 && matchableSteps[0] !== undefined
                ? (
                    <Button
                      icon={<EditorIcon name="list-checks" />}
                      size="small"
                      onClick={() => {
                        const first = matchableSteps[0];

                        if (first !== undefined) {
                          runMatch(first);
                        }
                      }}
                    >
                      按名称匹配
                    </Button>
                  )
                : (
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: matchDropdownItems,
                        onClick: event => {
                          const picked = matchableSteps.find(step => `${step.index}:${step.output}` === event.key);

                          if (picked !== undefined) {
                            runMatch(picked);
                          }
                        }
                      }}
                    >
                      <Button icon={<EditorIcon name="list-checks" />} size="small">
                        按名称匹配
                      </Button>
                    </Dropdown>
                  )}
            </div>
          )
        : null}

      {matchStatus === null
        ? null
        : <span css={statusCss} role="status">{matchStatus}</span>}

      <DragDropProvider modifiers={[RestrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        <div css={rowsCss}>
          {assignments.map((assignment, index) => {
            const id = rowIds[index];

            if (id === undefined) {
              return null;
            }

            return (
              <SortableAssignmentRow
                key={id}
                assignment={assignment}
                canRemove={assignments.length > 1}
                canReorder={assignments.length > 1}
                dataSources={dataSources}
                duplicated={duplicatedKeys.has(assignment.targetKey)}
                id={id}
                index={index}
                resolveTargetField={key => targetByKey.get(key)}
                targetField={targetByKey.get(assignment.targetKey)}
                targetOptions={targetOptions}
                onChange={next => updateAt(index, next)}
                onRemove={() => removeAt(index)}
              />
            );
          })}
        </div>
      </DragDropProvider>

      {duplicatedKeys.size > 0
        ? (
            <span css={duplicateWarningCss}>
              {`重复写入同一字段：${[...duplicatedKeys].map(key => targetByKey.get(key)?.label || key).join("、")}`}
            </span>
          )
        : null}

      <Button
        css={addInlineButtonCss}
        icon={<EditorIcon name="plus" />}
        size="small"
        type="dashed"
        onClick={addRow}
      >
        新增字段赋值
      </Button>
    </div>
  );
}
