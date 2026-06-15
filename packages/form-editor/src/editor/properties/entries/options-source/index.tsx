import type { FC, ReactElement } from "react";

import type { EntryComponentProps, FieldOptionSource, FormDataSource } from "../../../../types";
import type { OptionSourceKind } from "./source-mutators";

import { css } from "@emotion/react";
import { globalCssVars, Popconfirm, Segmented, Select } from "@vef-framework-react/components";

import { OptionListEditor, RemoteRequestFields } from "../../option-editors";
import { useConfirmableKindSwitch } from "../../use-confirmable-kind-switch";
import { descriptionCss, entryLabelCss } from "../entry-field";
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
  { value: "ref", label: "引用数据源" },
  { value: "remote", label: "远程请求" }
];

function isOptionSourceKind(value: unknown): value is OptionSourceKind {
  return value === "static" || value === "ref" || value === "remote";
}

function readSource(value: unknown): FieldOptionSource {
  if (value && typeof value === "object" && "kind" in value) {
    return value as FieldOptionSource;
  }

  return { kind: "static", options: [] };
}

/**
 * Editor for a selection field's option source. A segmented control switches
 * between an inline static list, a reference to a form-global data source, and
 * an inline remote request — the three arms of {@link FieldOptionSource}, all
 * resolved at runtime by `useFieldOptions`.
 */
export const OptionsSourceEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  schema,
  onChange
}) => {
  const source = readSource(entry.read(field));
  // The three kinds share no payload, so switching a configured source discards
  // work and is gated behind a confirmation; an unconfigured source switches
  // instantly.
  const kindSwitch = useConfirmableKindSwitch<OptionSourceKind>({
    current: source.kind,
    needsConfirm: optionSourceHasPayload(source),
    commit: kind => onChange(setOptionSourceKind(source, kind))
  });

  return (
    <div css={wrapperCss}>
      <span css={entryLabelCss}>{entry.label}</span>

      <Popconfirm
        cancelText="取消"
        okText="切换"
        open={kindSwitch.pendingKind !== null}
        title="切换选项来源将丢弃当前配置"
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
        ? <OptionListEditor options={source.options} onChange={next => onChange({ kind: "static", options: next })} />
        : null}

      {source.kind === "ref" ? <RefSource dataSourceId={source.dataSourceId} dataSources={schema.dataSources ?? []} onChange={onChange} /> : null}

      {source.kind === "remote"
        ? (
            <RemoteRequestFields
              mapping={source.mapping}
              request={source.request}
              onChange={(request, mapping) => onChange({
                ...source,
                request,
                mapping
              })}
            />
          )
        : null}

      {entry.description ? <span css={descriptionCss}>{entry.description}</span> : null}
    </div>
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
    return <span css={emptyCss}>表单暂无数据源，请先在「表单配置 · 数据源」中添加</span>;
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
