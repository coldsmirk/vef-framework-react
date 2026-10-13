import type { ChangeEvent, ReactElement, ReactNode } from "react";

import type { DataSourceApiParam, DynamicValue, RemoteDataSourceRequest } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input } from "@vef-framework-react/components";
import { omit } from "@vef-framework-react/shared";
import { useMemo, useState } from "react";

import { EditorIcon } from "../../icons";
import { DynamicValueEditor } from "./dynamic-value-editor";

export const requestGridCss = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 8
});

/**
 * The vertical rhythm of a whole request editor: its groups sit further apart
 * than the controls inside a group.
 */
export const requestEditorCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 14
});

// resource / action share the row; the version is a short token beside them.
// The row wraps instead of shrinking: in a narrow panel the version drops to a
// line of its own rather than squeezing an action name like `find_options`
// into a clipped box.
const endpointRowCss = css({
  display: "flex",
  flexWrap: "wrap",
  gap: 8,

  "& > *": {
    flex: "1 1 120px"
  },

  "& > :last-child": {
    flex: "0 0 72px"
  }
});

const sectionCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

const sectionHeaderCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 2
});

const sectionTitleCss = css({
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary
});

const sectionHintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorTextTertiary
});

const labeledControlCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0
});

const controlLabelCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.4,
  color: globalCssVars.colorTextTertiary
});

const warningCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorWarningText,
  lineHeight: 1.5
});

const rowCss = css({
  display: "flex",
  alignItems: "flex-start",
  gap: 8
});

const nameCellCss = css({
  width: 120,
  flexShrink: 0
});

const nameColumnCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 2
});

const declaredNameCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  paddingTop: 5,
  minWidth: 0,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorText,
  wordBreak: "break-all"
});

const requiredMarkCss = css({
  marginLeft: 2,
  color: globalCssVars.colorError
});

const paramNameCss = css({
  fontFamily: globalCssVars.fontFamilyCode,
  color: globalCssVars.colorTextTertiary
});

const valueCellCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: 1,
  minWidth: 0
});

const hintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorTextTertiary
});

const EMPTY_LITERAL: DynamicValue = { kind: "literal", value: "" };

const NO_DECLARED_PARAMS: readonly DataSourceApiParam[] = [];

type RequestParams = RemoteDataSourceRequest["params"];

type ParamEntry = [name: string, value: DynamicValue];

/**
 * A row added with "新增参数" that has no name yet. A param cannot be stored
 * without a name, so it waits here — UI-only, keyed by `id` — until it gets
 * one that no other parameter holds.
 */
interface PendingParamRow {
  id: string;
  value: DynamicValue;
}

let pendingParamRowCounter = 0;

function nextPendingParamRowId(): string {
  pendingParamRowCounter += 1;

  return `param-row-${pendingParamRowCounter}`;
}

function isUnbound(value: DynamicValue): boolean {
  return value.kind === "literal" && (value.value === undefined || value.value === "");
}

function paramsFrom(entries: readonly ParamEntry[]): RequestParams {
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * A request with its params replaced, omitting the key when there are none.
 */
export function withRequestParams(request: RemoteDataSourceRequest, params: RequestParams): RemoteDataSourceRequest {
  return params === undefined ? omit(request, ["params"]) : { ...request, params };
}

export interface RequestSectionProps {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}

/**
 * One part of a request — its field mapping, its parameters — under a quiet
 * caption, so the editor reads as a few named groups rather than one run of
 * inputs.
 */
export function RequestSection({
  children,
  hint,
  title
}: RequestSectionProps): ReactElement {
  return (
    <div css={sectionCss}>
      <div css={sectionHeaderCss}>
        <span css={sectionTitleCss}>{title}</span>
        {hint === undefined ? null : <span css={sectionHintCss}>{hint}</span>}
      </div>

      {children}
    </div>
  );
}

/**
 * A control under a small caption. A placeholder is no label: it vanishes the
 * moment the field holds a value, and `md/staff` beside `find_options` no
 * longer says which box is the resource.
 */
export function LabeledControl({ children, label }: { label: string; children: ReactNode }): ReactElement {
  return (
    <label css={labeledControlCss}>
      <span css={controlLabelCss}>{label}</span>
      {children}
    </label>
  );
}

export interface RequestParamsEditorProps {
  params: RequestParams;
  /**
   * The parameters an API declares: listed first, under their names and
   * labels, with only the value to bind. Free rows follow either way.
   */
  declared?: readonly DataSourceApiParam[];
  onChange: (params: RequestParams) => void;
}

/**
 * Editor for a request's parameters. Each value is a fixed literal or an
 * expression evaluated against the live form, which is what makes a cascading
 * select work.
 *
 * The `params` record is the only source of truth for a named parameter. A
 * name is draft-buffered and committed on blur / Enter, and only once it is
 * non-blank and held by no other parameter — so a rename in progress can never
 * collapse two rows into one record key (and lose a value) or store a param
 * named `""`. An unbound declared parameter is omitted rather than sent empty:
 * an empty filter is not "no filter".
 */
export function RequestParamsEditor({
  declared = NO_DECLARED_PARAMS,
  onChange,
  params
}: RequestParamsEditorProps): ReactElement {
  const [pending, setPending] = useState<PendingParamRow[]>([]);
  const declaredNames = useMemo(() => new Set(declared.map(param => param.name)), [declared]);
  const entries: ParamEntry[] = Object.entries(params ?? {});
  const freeEntries = entries.filter(([name]) => !declaredNames.has(name));

  const isTaken = (name: string): boolean => declaredNames.has(name) || entries.some(([existing]) => existing === name);

  const commit = (next: ParamEntry[]): void => {
    onChange(paramsFrom(next));
  };

  const setValue = (name: string, value: DynamicValue): void => {
    const exists = entries.some(([existing]) => existing === name);

    commit(exists ? entries.map(([existing, current]) => [existing, existing === name ? value : current]) : [...entries, [name, value]]);
  };

  const setDeclaredValue = (name: string, value: DynamicValue): void => {
    if (isUnbound(value)) {
      commit(entries.filter(([existing]) => existing !== name));
      return;
    }

    setValue(name, value);
  };

  const nameRow = (row: PendingParamRow, name: string): void => {
    setPending(rows => rows.filter(candidate => candidate.id !== row.id));
    commit([...entries, [name, row.value]]);
  };

  return (
    <RequestSection hint="固定值，或引用表单字段 / 系统变量的表达式（可做级联）" title="请求参数">

      {declared.map(param => (
        <DeclaredParamRow
          key={param.name}
          param={param}
          value={params?.[param.name]}
          onChange={value => setDeclaredValue(param.name, value)}
        />
      ))}

      {freeEntries.map(([name, value]) => (
        <FreeParamRow
          key={name}
          isTaken={isTaken}
          name={name}
          value={value}
          onNameCommit={next => commit(entries.map(([existing, current]) => [existing === name ? next : existing, current]))}
          onRemove={() => commit(entries.filter(([existing]) => existing !== name))}
          onValueChange={next => setValue(name, next)}
        />
      ))}

      {pending.map(row => (
        <FreeParamRow
          key={row.id}
          isTaken={isTaken}
          name=""
          value={row.value}
          onNameCommit={next => nameRow(row, next)}
          onRemove={() => setPending(rows => rows.filter(candidate => candidate.id !== row.id))}
          onValueChange={next => setPending(rows => rows.map(candidate => candidate.id === row.id ? { ...candidate, value: next } : candidate))}
        />
      ))}

      <Button
        block
        icon={<EditorIcon name="plus" />}
        type="dashed"
        onClick={() => setPending(rows => [...rows, { id: nextPendingParamRowId(), value: EMPTY_LITERAL }])}
      >
        新增参数
      </Button>
    </RequestSection>
  );
}

interface FreeParamRowProps {
  name: string;
  value: DynamicValue;
  isTaken: (name: string) => boolean;
  onNameCommit: (name: string) => void;
  onValueChange: (value: DynamicValue) => void;
  onRemove: () => void;
}

/**
 * A parameter the designer names. The name is a draft while it is edited (see
 * {@link RequestParamsEditor}); a blank or taken name is flagged and, on
 * commit, discarded in favour of the name the row already had.
 */
function FreeParamRow({
  isTaken,
  name,
  onNameCommit,
  onRemove,
  onValueChange,
  value
}: FreeParamRowProps): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const candidate = (draft ?? name).trim();
  const collides = candidate.length > 0 && candidate !== name && isTaken(candidate);

  const commit = (): void => {
    if (draft === null) {
      return;
    }

    setDraft(null);

    if (candidate.length > 0 && candidate !== name && !collides) {
      onNameCommit(candidate);
    }
  };

  return (
    <div css={rowCss}>
      <div css={[nameCellCss, nameColumnCss]}>
        <Input
          aria-label="参数名"
          placeholder="参数名"
          status={collides ? "warning" : undefined}
          value={draft ?? name}
          onBlur={commit}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
          onFocus={() => setDraft(name)}
          onPressEnter={commit}
        />

        {collides ? <span css={warningCss}>参数名已存在</span> : null}
      </div>

      <div css={valueCellCss}>
        <DynamicValueEditor
          expressionPlaceholder="$form.departmentId"
          literalPlaceholder="固定值"
          value={value}
          onChange={onValueChange}
        />
      </div>

      <Button aria-label="删除参数" icon={<EditorIcon name="trash-2" />} type="text" onClick={onRemove} />
    </div>
  );
}

interface DeclaredParamRowProps {
  param: DataSourceApiParam;
  value: DynamicValue | undefined;
  onChange: (value: DynamicValue) => void;
}

function DeclaredParamRow({
  onChange,
  param,
  value
}: DeclaredParamRowProps): ReactElement {
  const label = param.label ?? param.name;
  const unbound = value === undefined || isUnbound(value);

  return (
    <div css={rowCss}>
      <div css={[nameCellCss, declaredNameCss]}>
        <span>
          {label}
          {param.required ? <span aria-hidden css={requiredMarkCss}>*</span> : null}
        </span>

        {label === param.name ? null : <span css={paramNameCss}>{param.name}</span>}
      </div>

      <div css={valueCellCss}>
        <DynamicValueEditor
          expressionPlaceholder="$applicant.departmentId"
          literalPlaceholder={param.required ? "必填" : "可选，留空则不传"}
          value={value ?? EMPTY_LITERAL}
          onChange={onChange}
        />

        {param.required && unbound ? <span css={warningCss}>必填参数尚未绑定</span> : null}
        {param.description ? <span css={hintCss}>{param.description}</span> : null}
      </div>
    </div>
  );
}

export interface RemoteRequestEditorProps {
  request: RemoteDataSourceRequest;
  onChange: (request: RemoteDataSourceRequest) => void;
}

/**
 * The hand-entered endpoint: resource / action / version.
 */
export function RequestEndpointFields({ onChange, request }: RemoteRequestEditorProps): ReactElement {
  const setVersion = (version: string): void => {
    // A cleared version is "the default", not an empty version to send.
    onChange(version.trim().length > 0 ? { ...request, version } : omit(request, ["version"]));
  };

  return (
    <div css={endpointRowCss}>
      <LabeledControl label="资源">
        <Input placeholder="如 sys/user" value={request.resource} onChange={event => onChange({ ...request, resource: event.target.value })} />
      </LabeledControl>

      <LabeledControl label="动作">
        <Input placeholder="如 find_options" value={request.action} onChange={event => onChange({ ...request, action: event.target.value })} />
      </LabeledControl>

      <LabeledControl label="版本">
        <Input placeholder="v1" value={request.version ?? ""} onChange={event => setVersion(event.target.value)} />
      </LabeledControl>
    </div>
  );
}

/**
 * Hand-entered endpoint plus its parameters — the editor for an `api_call`
 * action's request.
 */
export function RemoteRequestEditor({ onChange, request }: RemoteRequestEditorProps): ReactElement {
  return (
    <div css={requestEditorCss}>
      <RequestEndpointFields request={request} onChange={onChange} />
      <RequestParamsEditor params={request.params} onChange={params => onChange(withRequestParams(request, params))} />
    </div>
  );
}
