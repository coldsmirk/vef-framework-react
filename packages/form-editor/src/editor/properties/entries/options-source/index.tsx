import type { FC, ReactElement } from "react";

import type { EntryComponentProps, FieldOptionSource, FormDataSource } from "../../../../types";
import type { ReferenceScope } from "../../reference-scope";
import type { OptionSourceKind } from "./source-mutators";

import { css } from "@emotion/react";
import { globalCssVars, Popconfirm, Segmented, Select } from "@vef-framework-react/components";
import { useMemo } from "react";

import { isTreeSelectFieldType } from "../../../../engine/options";
import { findScope } from "../../../../engine/schema/walk";
import { useContextSources } from "../../../context-sources";
import { OptionListEditor } from "../../option-editors";
import { ReferenceScopeProvider } from "../../reference-scope";
import { RemoteOptionSourceEditor } from "../../remote-option-source-editor";
import { useConfirmableKindSwitch } from "../../use-confirmable-kind-switch";
import { descriptionCss, entryLabelCss } from "../entry-field";
import { collectSourceCandidates, getSourceFieldOptions } from "../linkage/options";
import { CodeSetSource } from "./code-set-source";
import { optionSourceHasPayload, setOptionSourceKind } from "./source-mutators";

const wrapperCss = css({
  display: "flex",
  flexDirection: "column",
  // Matches EntryField's gap so this hand-rolled entry shares the field rhythm.
  gap: 6
});

const emptyCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const selectStyle = { width: "100%" } as const;

const KIND_OPTIONS: Array<{ value: OptionSourceKind; label: string }> = [
  { value: "static", label: "静态选项" },
  { value: "ref", label: "数据源" },
  { value: "remote", label: "远程请求" },
  { value: "codeSet", label: "数据字典" }
];

function isOptionSourceKind(value: unknown): value is OptionSourceKind {
  return value === "static" || value === "ref" || value === "remote" || value === "codeSet";
}

function readSource(value: unknown): FieldOptionSource {
  if (value && typeof value === "object" && "kind" in value) {
    return value as FieldOptionSource;
  }

  return { kind: "static", options: [] };
}

export interface OptionSourceEditorProps {
  allowBulkPaste?: boolean;
  allowHierarchy?: boolean;
  confirmTitle?: string;
  dataSources: FormDataSource[];
  description?: string;
  label: string;
  source: FieldOptionSource;
  onChange: (next: FieldOptionSource) => void;
}

/**
 * Reusable editor for any {@link FieldOptionSource} (selection fields and
 * fixed-row subforms alike). A segmented control switches between an inline
 * static list, a form-global data-source ref, an inline remote request, and a
 * host data dictionary — gated behind a confirmation when switching discards
 * configured payload.
 */
export function OptionSourceEditor({
  allowBulkPaste = false,
  allowHierarchy = false,
  confirmTitle = "切换选项来源将丢弃当前配置",
  dataSources,
  description,
  label,
  onChange,
  source
}: OptionSourceEditorProps): ReactElement {
  const kindSwitch = useConfirmableKindSwitch<OptionSourceKind>({
    current: source.kind,
    needsConfirm: optionSourceHasPayload(source),
    commit: kind => onChange(setOptionSourceKind(source, kind))
  });

  return (
    <div css={wrapperCss}>
      <span css={entryLabelCss}>{label}</span>

      <Popconfirm
        cancelText="取消"
        okText="切换"
        open={kindSwitch.pendingKind !== null}
        title={confirmTitle}
        onCancel={kindSwitch.cancel}
        onConfirm={kindSwitch.confirm}
      >
        <Segmented
          block
          options={KIND_OPTIONS}
          value={source.kind}
          onChange={value => {
            if (isOptionSourceKind(value)) {
              kindSwitch.requestKind(value);
            }
          }}
        />
      </Popconfirm>

      {source.kind === "static"
        ? (
            <OptionListEditor
              allowBulkPaste={allowBulkPaste || allowHierarchy}
              allowHierarchy={allowHierarchy}
              options={source.options}
              onChange={next => onChange({ kind: "static", options: next })}
            />
          )
        : null}

      {source.kind === "ref" ? <RefSource dataSourceId={source.dataSourceId} dataSources={dataSources} onChange={onChange} /> : null}

      {source.kind === "remote"
        ? (
            <RemoteOptionSourceEditor
              mapping={source.mapping}
              request={source.request}
              onChange={(request, mapping) => onChange({
                kind: "remote",
                request,
                ...mapping !== undefined && { mapping }
              })}
            />
          )
        : null}

      {source.kind === "codeSet" ? <CodeSetSource codeSet={source.codeSet} onChange={codeSet => onChange({ kind: "codeSet", codeSet })} /> : null}
      {description ? <span css={descriptionCss}>{description}</span> : null}
    </div>
  );
}

/**
 * Property-entry wrapper around {@link OptionSourceEditor} for selection fields.
 * Provides a {@link ReferenceScopeProvider} so inline remote option params
 * offer the same grouped field / variable / system-variable picker as linkage.
 */
export const OptionsSourceEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  schema,
  onChange
}) => {
  const contextSources = useContextSources();
  const referenceScope = useMemo<ReferenceScope>(() => {
    const mobileLayer = schema.presentations.mobile;
    const pcScope = findScope(schema.presentations.pc, field.id);
    const mobileScope = pcScope === undefined && mobileLayer !== undefined
      ? findScope(mobileLayer, field.id)
      : undefined;
    const ownerLayer = mobileScope !== undefined && mobileLayer !== undefined
      ? mobileLayer
      : schema.presentations.pc;
    const scopeKey = (pcScope ?? mobileScope ?? []).join("/");
    const candidates = collectSourceCandidates(ownerLayer, scope => scope.join("/") === scopeKey);

    return {
      fieldOptions: getSourceFieldOptions({ components: candidates }),
      variables: schema.variables ?? [],
      contextSources,
      allowSteps: false
    };
  }, [schema.presentations.pc, schema.presentations.mobile, field.id, schema.variables, contextSources]);

  return (
    <ReferenceScopeProvider value={referenceScope}>
      <OptionSourceEditor
        allowHierarchy={isTreeSelectFieldType(field.type)}
        dataSources={schema.dataSources ?? []}
        description={entry.description}
        label={entry.label}
        source={readSource(entry.read(field))}
        onChange={onChange}
      />
    </ReferenceScopeProvider>
  );
};

function RefSource({
  dataSourceId,
  dataSources,
  onChange
}: {
  dataSourceId: string;
  dataSources: FormDataSource[];
  onChange: (next: FieldOptionSource) => void;
}): ReactElement {
  if (dataSources.length === 0) {
    return <span css={emptyCss}>表单暂无数据源，请先在左侧「数据」页中添加</span>;
  }

  return (
    <Select
      options={dataSources.map(source => { return { value: source.id, label: `${source.name} · ${source.id}` }; })}
      placeholder="选择数据源"
      style={selectStyle}
      value={dataSourceId.length > 0 ? dataSourceId : undefined}
      onChange={value => onChange({ kind: "ref", dataSourceId: String(value) })}
    />
  );
}
