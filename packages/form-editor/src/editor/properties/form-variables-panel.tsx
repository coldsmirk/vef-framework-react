import type { ChangeEvent, ReactElement } from "react";

import type { FormVariable } from "../../types";
import type { DataEntrySession } from "./use-data-entry-editor";

import { css } from "@emotion/react";
import { globalCssVars, Input, Segmented } from "@vef-framework-react/components";
import { isDeepEqual } from "@vef-framework-react/shared";
import { useEffect, useId, useRef, useState } from "react";

import { createId } from "../../engine/ids";
import { nextUniqueKey } from "../../engine/keys";
import { isValidVariableName } from "../../engine/schema/validate";
import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import {
  DataListEmpty,
  dataListItemsCss,
  dataListNameCss,
  dataListPrimaryLineCss,
  DataListRow,
  dataListSecondaryLineCss,
  DataListSectionHeader,
  dataListSummaryCss,
  dataListUnnamedCss,
  dataListWrapperCss
} from "./data-list";
import { DraftField, DraftModal } from "./draft-modal";
import { useDataEntryEditor } from "./use-data-entry-editor";

type VariableType = FormVariable["type"];

const VARIABLE_TYPE_OPTIONS: Array<{ value: VariableType; label: string }> = [
  { value: "string", label: "文本" },
  { value: "number", label: "数字" },
  { value: "boolean", label: "布尔" },
  { value: "json", label: "JSON" }
];

const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  string: "文本",
  number: "数字",
  boolean: "布尔",
  json: "JSON"
};

const BOOLEAN_OPTIONS = [
  { value: "true", label: "是" },
  { value: "false", label: "否" }
] as const;

const MODAL_WIDTH = 480;

// Stable empty fallback: a fresh array each render would re-run the editor's
// jump effect on every edit of a form without variables.
const NO_VARIABLES: FormVariable[] = [];

const codeTextAreaStyle = {
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: globalCssVars.fontSizeSm
} as const;

const variableNameCss = css({
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: 13
});

const typeBadgeCss = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  height: 18,
  padding: "0 5px",
  borderRadius: 4,
  background: globalCssVars.colorFillSecondary,
  color: globalCssVars.colorTextSecondary,
  fontSize: 11,
  lineHeight: 1
});

const unsetDefaultCss = css({
  color: globalCssVars.colorTextQuaternary
});

function isVariableType(value: unknown): value is VariableType {
  return value === "string" || value === "number" || value === "boolean" || value === "json";
}

function stringifyDefault(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatDefaultSummary(variable: FormVariable): string | null {
  if (variable.defaultValue === undefined) {
    return null;
  }

  if (variable.type === "boolean") {
    return variable.defaultValue === true ? "是" : "否";
  }

  const text = stringifyDefault(variable.defaultValue);

  return text.length > 0 ? text : "\"\"";
}

function getVariableNameError(
  trimmedName: string,
  isDuplicate: boolean,
  showEmptyError: boolean
): string | null {
  if (trimmedName.length === 0) {
    return showEmptyError ? "请输入变量名" : null;
  }

  if (!isValidVariableName(trimmedName)) {
    return "仅支持字母、数字和下划线，且不能以数字开头";
  }

  if (isDuplicate) {
    return "已存在同名变量，请更换名称";
  }

  return null;
}

function parseDefaultDraft(
  type: VariableType,
  rawText: string,
  boolValue: boolean
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (type === "boolean") {
    return { ok: true, value: boolValue };
  }

  if (rawText.length === 0) {
    return { ok: true, value: undefined };
  }

  if (type === "number") {
    const trimmed = rawText.trim();

    if (trimmed.length === 0) {
      return { ok: true, value: undefined };
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed)
      ? { ok: true, value: parsed }
      : { ok: false, error: "请输入有效的数字" };
  }

  if (type === "json") {
    const trimmed = rawText.trim();

    if (trimmed.length === 0) {
      return { ok: true, value: undefined };
    }

    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      return { ok: false, error: "请输入合法的 JSON" };
    }
  }

  return { ok: true, value: rawText };
}

function createBlankVariable(): FormVariable {
  return {
    id: createId("Var"),
    name: "",
    type: "string"
  };
}

export interface FormVariablesPanelProps {
  title: string;
  titleLevel?: "main" | "sub";
}

/**
 * Form-global variable manager. Renders each variable as a compact two-line
 * row (name + type badge, default value) matching the data-source list, and
 * edits it in a draft-buffered modal. `saveVariable` carries a rename through
 * every `$vars` and `set_variable` reference in the same undo step.
 */
export function FormVariablesPanel({ title, titleLevel = "main" }: FormVariablesPanelProps): ReactElement {
  const variables = useFormEditorStore(s => s.schema.variables) ?? NO_VARIABLES;
  const storeApi = useFormEditorStoreApi();
  const {
    close,
    closeIfEditing,
    editingId,
    handleAfterClose,
    openCreate,
    openEdit,
    rowRef,
    session
  } = useDataEntryEditor({
    createBlank: createBlankVariable,
    entries: variables,
    kind: "variable"
  });

  const handleSave = (next: FormVariable): void => {
    storeApi.getState().saveVariable(next);
    close();
  };

  const handleDuplicate = (variable: FormVariable): void => {
    const usedNames = new Set(variables.map(item => item.name).filter(name => name.length > 0));
    const base = isValidVariableName(variable.name) ? variable.name : "var";

    storeApi.getState().saveVariable(
      {
        ...structuredClone(variable),
        id: createId("Var"),
        name: nextUniqueKey(usedNames, base)
      },
      { after: variable.id }
    );
  };

  return (
    <div css={dataListWrapperCss}>
      <DataListSectionHeader
        addLabel="新增变量"
        count={variables.length}
        title={title}
        titleLevel={titleLevel}
        onAdd={openCreate}
      />

      {variables.length === 0
        ? <DataListEmpty hint="可在联动或表达式中以 $vars.名称 引用" title="暂无变量" />
        : (
            <div aria-label="表单变量列表" css={dataListItemsCss} role="list">
              {variables.map(variable => {
                const unnamed = variable.name.length === 0;
                const displayName = unnamed ? "未命名变量" : variable.name;
                const defaultSummary = formatDefaultSummary(variable);

                return (
                  <DataListRow
                    key={variable.id}
                    active={editingId === variable.id}
                    deleteAriaLabel={`删除变量 ${displayName}`}
                    duplicateAriaLabel={`复制变量 ${displayName}`}
                    editAriaLabel={`编辑变量 ${displayName}`}
                    rowRef={rowRef(variable.id)}
                    primary={(
                      <span css={dataListPrimaryLineCss}>
                        <span css={[dataListNameCss, !unnamed && variableNameCss, unnamed && dataListUnnamedCss]}>
                          {displayName}
                        </span>

                        <span css={typeBadgeCss}>{VARIABLE_TYPE_LABELS[variable.type]}</span>
                      </span>
                    )}
                    secondary={(
                      <span css={dataListSecondaryLineCss}>
                        {defaultSummary === null
                          ? <span css={[dataListSummaryCss, unsetDefaultCss]}>无默认值</span>
                          : <span css={dataListSummaryCss}>{`默认：${defaultSummary}`}</span>}
                      </span>
                    )}
                    onDelete={() => {
                      storeApi.getState().removeVariable(variable.id);
                      closeIfEditing(variable.id);
                    }}
                    onDuplicate={() => handleDuplicate(variable)}
                    onEdit={() => openEdit(variable)}
                  />
                );
              })}
            </div>
          )}

      {session === null
        ? null
        : (
            <VariableModal
              key={session.key}
              session={session}
              variables={variables}
              onAfterClose={handleAfterClose}
              onClose={close}
              onSave={handleSave}
            />
          )}
    </div>
  );
}

interface VariableModalProps {
  session: DataEntrySession<FormVariable>;
  variables: readonly FormVariable[];
  onSave: (next: FormVariable) => void;
  onClose: () => void;
  onAfterClose: () => void;
}

function VariableModal({
  onAfterClose,
  onClose,
  onSave,
  session,
  variables
}: VariableModalProps): ReactElement {
  const nameInputId = useId();
  const defaultInputId = useId();
  const nameInputRef = useRef<{ focus: () => void } | null>(null);

  const initialDefaultText = session.initial.type === "boolean" ? "" : stringifyDefault(session.initial.defaultValue);
  const initialBoolDefault = session.initial.defaultValue === true;

  const [name, setName] = useState(session.initial.name);
  const [type, setType] = useState<VariableType>(session.initial.type);
  const [defaultText, setDefaultText] = useState(initialDefaultText);
  const [boolDefault, setBoolDefault] = useState(initialBoolDefault);
  const [nameEdited, setNameEdited] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isDirty = name !== session.initial.name
    || type !== session.initial.type
    || (type === "boolean" ? boolDefault !== initialBoolDefault : defaultText !== initialDefaultText);

  const trimmedName = name.trim();
  const isDuplicate = trimmedName.length > 0
    && variables.some(other => other.id !== session.initial.id && other.name === trimmedName);

  const nameError = getVariableNameError(trimmedName, isDuplicate, submitAttempted || nameEdited);

  const parsedDefault = parseDefaultDraft(type, defaultText, boolDefault);
  const defaultError = !parsedDefault.ok && submitAttempted ? parsedDefault.error : null;

  useEffect(() => {
    if (session.mode === "create") {
      nameInputRef.current?.focus();
    }
  }, [session.mode]);

  const handleTypeChange = (nextType: VariableType): void => {
    if (nextType === type) {
      return;
    }

    setType(nextType);

    if (nextType === "boolean") {
      // Boolean is binary with no "unset" Segmented state, so seed a concrete
      // `false` — otherwise the UI shows "否" while the stored value stays
      // `undefined`, diverging from `=== false` / `empty`.
      setBoolDefault(false);
    } else {
      setDefaultText("");
    }
  };

  const handleConfirm = (): void => {
    setSubmitAttempted(true);

    if (trimmedName.length === 0 || !isValidVariableName(trimmedName) || isDuplicate) {
      nameInputRef.current?.focus();
      return;
    }

    if (!parsedDefault.ok) {
      return;
    }

    const nextVariable: FormVariable = {
      id: session.initial.id,
      name: trimmedName,
      type,
      ...parsedDefault.value !== undefined && { defaultValue: parsedDefault.value }
    };

    if (session.mode === "edit" && isDeepEqual(nextVariable, session.initial)) {
      onClose();
      return;
    }

    onSave(nextVariable);
  };

  return (
    <DraftModal
      dirty={isDirty}
      open={session.open}
      title={session.mode === "create" ? "新增变量" : "编辑变量"}
      width={MODAL_WIDTH}
      onAfterClose={onAfterClose}
      onClose={onClose}
      onSubmit={handleConfirm}
    >
      <DraftField
        required
        error={nameError}
        hint={`在表达式中以 $vars.${trimmedName || "变量名"} 引用`}
        htmlFor={nameInputId}
        label="变量名"
      >
        <Input
          ref={instance => {
            nameInputRef.current = instance;
          }}
          id={nameInputId}
          placeholder="例如：total、isVip"
          status={nameError === null ? undefined : "error"}
          value={name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setNameEdited(true);
            setName(event.target.value);
          }}
        />
      </DraftField>

      <DraftField label="类型">
        <Segmented
          block
          options={VARIABLE_TYPE_OPTIONS}
          value={type}
          onChange={value => {
            if (isVariableType(value)) {
              handleTypeChange(value);
            }
          }}
        />
      </DraftField>

      <DraftField error={defaultError} htmlFor={type === "boolean" ? undefined : defaultInputId} label="默认值">
        {type === "boolean"
          ? (
              <Segmented
                block
                options={[...BOOLEAN_OPTIONS]}
                value={boolDefault ? "true" : "false"}
                onChange={value => setBoolDefault(value === "true")}
              />
            )
          : type === "json"
            ? (
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  id={defaultInputId}
                  placeholder="可选，如 {&quot;a&quot;: 1}"
                  spellCheck={false}
                  status={defaultError === null ? undefined : "error"}
                  style={codeTextAreaStyle}
                  value={defaultText}
                  onChange={event => setDefaultText(event.target.value)}
                />
              )
            : (
                <Input
                  id={defaultInputId}
                  placeholder={type === "number" ? "可选，如 3.14" : "可选，留空表示未设置"}
                  status={defaultError === null ? undefined : "error"}
                  value={defaultText}
                  onChange={event => setDefaultText(event.target.value)}
                />
              )}
      </DraftField>
    </DraftModal>
  );
}
