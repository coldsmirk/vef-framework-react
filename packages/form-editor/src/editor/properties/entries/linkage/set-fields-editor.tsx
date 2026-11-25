import type { DropdownMenuItem, SelectProps } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { PriorStepSchema, WritableTargetField } from "../../../../engine/linkage";
import type { FieldAssignment, FormDataSource } from "../../../../types";
import type { SourceFieldOption } from "./options";
import type { LinkageScope } from "./use-linkage-editor-model";

import { css } from "@emotion/react";
import { Button, Dropdown, globalCssVars, Select } from "@vef-framework-react/components";
import { DragDropProvider, RestrictToVerticalAxis, useSortable } from "@vef-framework-react/core";
import { isDeepEqual } from "@vef-framework-react/shared";
import { useMemo, useState } from "react";

import { matchStepFieldsToTargets } from "../../../../engine/linkage";
import { EditorIcon } from "../../../../icons";
import { DynamicValueEditor } from "../../dynamic-value-editor";
import { useReferenceScope } from "../../reference-scope";
import { draggingRowCss, DragHandle, useSortableRows } from "../../sortable-rows";
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

const BLANK_ASSIGNMENT: FieldAssignment = { targetKey: "", value: { kind: "literal", value: "" } };

/**
 * Point an assignment at another target. A value nothing was typed into starts
 * over in the shape the new target takes.
 */
function retarget(
  assignment: FieldAssignment,
  previous: WritableTargetField | undefined,
  next: WritableTargetField
): FieldAssignment {
  const { value } = assignment;
  const isUntouched = value.kind === "literal"
    && (value.value === undefined || isDeepEqual(value.value, defaultLiteralValueForField(previous)));

  return {
    ...assignment,
    targetKey: next.key,
    value: isUntouched ? { kind: "literal", value: defaultLiteralValueForField(next) } : value
  };
}

interface SortableAssignmentRowProps {
  id: string;
  index: number;
  assignment: FieldAssignment;
  targetOptions: SourceFieldOption[];
  targetField: WritableTargetField | undefined;
  dataSources: readonly FormDataSource[];
  duplicated: boolean;
  isOnlyRow: boolean;
  onChange: (next: FieldAssignment) => void;
  onRemove: () => void;
  onRetarget: (key: string) => void;
}

function SortableAssignmentRow({
  assignment,
  dataSources,
  duplicated,
  id,
  index,
  isOnlyRow,
  onChange,
  onRemove,
  onRetarget,
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
    <div ref={ref} css={[rowCardCss, !isOnlyRow && rowCardRemovableCss, isDragging && draggingRowCss]}>
      <div css={targetGroupCss}>
        {isOnlyRow ? null : <DragHandle handleRef={handleRef} />}

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
            onChange={value => onRetarget(String(value))}
          />
        </div>
      </div>

      <span aria-hidden css={arrowCss}>←</span>

      <div css={valueCellCss}>
        <DynamicValueEditor
          dataSources={dataSources}
          expressionPlaceholder="field.A"
          literalPlaceholder="写入的值"
          referencePlaceholder="选择来源字段或步骤"
          targetField={targetField}
          value={assignment.value}
          onChange={value => onChange({ ...assignment, value })}
        />
      </div>

      {isOnlyRow
        ? null
        : (
            <Button
              aria-label="删除字段赋值"
              css={[actionDeleteCss, deleteButtonCss]}
              icon={<EditorIcon name="x" />}
              size="small"
              type="text"
              onClick={onRemove}
            />
          )}
    </div>
  );
}

function collectDuplicates(assignments: readonly FieldAssignment[]): ReadonlySet<string> {
  const keys = assignments.map(assignment => assignment.targetKey).filter(key => key.length > 0);

  return new Set(keys.filter((key, index) => keys.indexOf(key) !== index));
}

export interface SetFieldsEditorProps {
  assignments: FieldAssignment[];
  scope: LinkageScope;
  onChange: (assignments: FieldAssignment[]) => void;
}

/**
 * The mapping table of a `set_fields` step: target field ← literal, reference
 * or expression, with the declared fields of an earlier step's result matched
 * onto the controls by name on request.
 */
export function SetFieldsEditor({
  assignments,
  onChange,
  scope
}: SetFieldsEditorProps): ReactElement {
  const {
    dataSources,
    targetOptions,
    writableTargets
  } = scope;
  const { priorSteps = [] } = useReferenceScope();
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const rows = useSortableRows(assignments, next => {
    setMatchStatus(null);
    onChange(next);
  });

  const targetByKey = useMemo(() => new Map(writableTargets.map(field => [field.key, field])), [writableTargets]);
  const duplicatedKeys = useMemo(() => collectDuplicates(assignments), [assignments]);

  // The nearest step first: the `select_record` right before this one ahead of
  // the `api_call` it draws from.
  const matchableSteps = priorSteps.filter(step => step.fields.length > 0).toReversed();

  const runMatch = (step: PriorStepSchema): void => {
    const { added, nextAssignments } = matchStepFieldsToTargets(step, writableTargets, assignments);

    if (added.length > 0) {
      rows.replaceAll(nextAssignments);
    }

    setMatchStatus(added.length > 0
      ? `已按名称匹配并新增 ${added.length} 项写入`
      : "没有可自动匹配的新字段（同名字段已全部映射或无同名项）");
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

      <DragDropProvider modifiers={[RestrictToVerticalAxis]} onDragEnd={rows.handleDragEnd}>
        <div css={rowsCss}>
          {assignments.map((assignment, index) => {
            const id = rows.ids[index];
            const targetField = targetByKey.get(assignment.targetKey);

            return id === undefined
              ? null
              : (
                  <SortableAssignmentRow
                    key={id}
                    assignment={assignment}
                    dataSources={dataSources}
                    duplicated={duplicatedKeys.has(assignment.targetKey)}
                    id={id}
                    index={index}
                    isOnlyRow={assignments.length === 1}
                    targetField={targetField}
                    targetOptions={targetOptions}
                    onChange={next => rows.update(index, next)}
                    onRemove={() => rows.remove(index)}
                    onRetarget={key => {
                      const next = targetByKey.get(key);

                      if (next !== undefined) {
                        rows.update(index, retarget(assignment, targetField, next));
                      }
                    }}
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
        onClick={() => rows.append([BLANK_ASSIGNMENT])}
      >
        新增字段赋值
      </Button>
    </div>
  );
}
