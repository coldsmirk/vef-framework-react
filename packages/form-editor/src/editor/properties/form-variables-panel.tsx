import type { ReactElement } from "react";

import type { FormVariable } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input, Segmented, Select } from "@vef-framework-react/components";
import { useState } from "react";

import { createId } from "../../engine/ids";
import { nextUniqueKey, sanitizeKey } from "../../engine/keys";
import { EditorIcon } from "../../icons";
import { useFormEditorStoreApi } from "../../store/form-store";

type VariableType = FormVariable["type"];

const VARIABLE_TYPE_OPTIONS: Array<{ value: VariableType; label: string }> = [
  { value: "string", label: "文本" },
  { value: "number", label: "数字" },
  { value: "boolean", label: "布尔" },
  { value: "json", label: "JSON" }
];

const BOOLEAN_OPTIONS = [
  { value: "true", label: "是" },
  { value: "false", label: "否" }
] as const;

const wrapperCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

const rowCss = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) 84px minmax(0, 1.4fr) auto",
  gap: 6,
  alignItems: "center"
});

const emptyCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const selectStyle = { width: "100%" } as const;

function isVariableType(value: unknown): value is VariableType {
  return value === "string" || value === "number" || value === "boolean" || value === "json";
}

/**
 * Coerce a variable's raw text input to its declared type. An empty input is
 * `undefined`; an invalid number / JSON falls back to the raw string so the user
 * can keep typing rather than losing their entry.
 */
function coerceDefault(type: VariableType, raw: string): unknown {
  if (raw.length === 0) {
    return undefined;
  }

  if (type === "number") {
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed : raw;
  }

  if (type === "json") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  return raw;
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

export interface FormVariablesPanelProps {
  variables: FormVariable[];
  onChange: (next: FormVariable[]) => void;
}

/**
 * Form-global variable manager. Each variable surfaces to expressions as
 * `$vars.<name>` with its `defaultValue`; the runtime seeds the evaluation scope
 * from this list.
 *
 * Add and type/default edits flow through `onChange` (the drawer patches
 * `schema.variables`); rename and delete go through the store's
 * `renameVariable` / `removeVariable` so `set_variable` references follow the
 * variable instead of dangling.
 */
export function FormVariablesPanel({ onChange, variables }: FormVariablesPanelProps): ReactElement {
  const storeApi = useFormEditorStoreApi();

  const update = (id: string, patch: Partial<FormVariable>): void => {
    onChange(variables.map(variable => variable.id === id ? { ...variable, ...patch } : variable));
  };

  const remove = (variable: FormVariable): void => {
    if (variable.name.length === 0) {
      // An unnamed variable cannot be referenced anywhere — a plain list
      // update suffices (and a name-keyed store action could not address it).
      onChange(variables.filter(candidate => candidate.id !== variable.id));
      return;
    }

    storeApi.getState().removeVariable(variable.name);
  };

  const commitName = (variable: FormVariable, raw: string): void => {
    const sanitized = sanitizeKey(raw);

    // An all-invalid / empty input keeps the current name rather than dropping
    // the binding (the draft-buffered field-key editor commits the same way).
    if (sanitized.length === 0 || sanitized === variable.name) {
      return;
    }

    // Unique among the other variables: a colliding name is uniquified with a
    // numeric suffix instead of silently shadowing its twin in `$vars`.
    const used = new Set(variables.filter(candidate => candidate.id !== variable.id).map(candidate => candidate.name));
    const unique = nextUniqueKey(used, sanitized);

    if (unique === variable.name) {
      return;
    }

    if (variable.name.length === 0) {
      // First naming — nothing can reference an unnamed variable, so this is a
      // plain field update, not a reference-following rename.
      update(variable.id, { name: unique });
      return;
    }

    storeApi.getState().renameVariable(variable.name, unique);
  };

  const add = (): void => {
    onChange([
      ...variables,
      {
        id: createId("Var"),
        name: "",
        type: "string"
      }
    ]);
  };

  return (
    <div css={wrapperCss}>
      {variables.length === 0 ? <span css={emptyCss}>暂无变量，可在联动 / 事件表达式中以 $vars.名称 引用</span> : null}

      {variables.map(variable => (
        <div key={variable.id} css={rowCss}>
          <VariableNameInput
            name={variable.name}
            onCommit={raw => commitName(variable, raw)}
          />

          <Select
            options={VARIABLE_TYPE_OPTIONS}
            style={selectStyle}
            value={variable.type}
            onChange={value => {
              if (isVariableType(value)) {
                // Boolean is binary with no "unset" Segmented state, so seed a
                // concrete `false` — otherwise the UI shows "否" while the stored
                // value stays `undefined`, diverging from `=== false` / `empty`.
                update(variable.id, { type: value, defaultValue: value === "boolean" ? false : undefined });
              }
            }}
          />

          {variable.type === "boolean"
            ? (
                <Segmented
                  block
                  options={[...BOOLEAN_OPTIONS]}
                  value={variable.defaultValue === true ? "true" : "false"}
                  onChange={value => update(variable.id, { defaultValue: value === "true" })}
                />
              )
            : (
                <VariableDefaultInput
                  value={variable.defaultValue}
                  onCommit={raw => update(variable.id, { defaultValue: coerceDefault(variable.type, raw) })}
                />
              )}

          <Button
            aria-label="删除变量"
            icon={<EditorIcon name="trash-2" />}
            type="text"
            onClick={() => remove(variable)}
          />
        </div>
      ))}

      <Button block icon={<EditorIcon name="plus" />} type="dashed" onClick={add}>新增变量</Button>
    </div>
  );
}

interface VariableNameInputProps {
  name: string;
  onCommit: (raw: string) => void;
}

/**
 * Draft-buffered name editor. The draft is seeded from the stored name when
 * editing starts and committed on blur / Enter — never re-seeded from live
 * data mid-edit — so sanitize/uniquify run once per commit instead of
 * mangling the text under the cursor (the schema-io seed-on-transition
 * pattern).
 */
function VariableNameInput({ name, onCommit }: VariableNameInputProps): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (): void => {
    if (draft === null) {
      return;
    }

    onCommit(draft);
    setDraft(null);
  };

  return (
    <Input
      placeholder="变量名"
      value={draft ?? name}
      onBlur={commit}
      onChange={event => setDraft(event.target.value)}
      onFocus={() => setDraft(name)}
      onPressEnter={commit}
    />
  );
}

interface VariableDefaultInputProps {
  value: unknown;
  onCommit: (raw: string) => void;
}

/**
 * Draft-buffered default-value editor for string / number / JSON variables.
 * Coercion happens once on blur / Enter, so a transient state like `3.` is
 * never round-tripped through `Number()` mid-edit (which swallowed the dot and
 * made `3.14` impossible to type); JSON text likewise is not re-stringified
 * under the cursor.
 */
function VariableDefaultInput({ value, onCommit }: VariableDefaultInputProps): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (): void => {
    if (draft === null) {
      return;
    }

    onCommit(draft);
    setDraft(null);
  };

  return (
    <Input
      placeholder="默认值"
      value={draft ?? stringifyDefault(value)}
      onBlur={commit}
      onChange={event => setDraft(event.target.value)}
      onFocus={() => setDraft(stringifyDefault(value))}
      onPressEnter={commit}
    />
  );
}
