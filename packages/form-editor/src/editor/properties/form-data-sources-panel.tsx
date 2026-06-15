import type { ChangeEvent, ReactElement } from "react";

import type { FormDataSource } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input, Popconfirm, Segmented } from "@vef-framework-react/components";

import { createId } from "../../engine/ids";
import { EditorIcon } from "../../icons";
import { useFormEditorStoreApi } from "../../store/form-store";
import { OptionListEditor, RemoteRequestFields } from "./option-editors";
import { useConfirmableKindSwitch } from "./use-confirmable-kind-switch";

type DataSourceKind = FormDataSource["kind"];

const KIND_OPTIONS = [
  { value: "static", label: "静态选项" },
  { value: "remote", label: "远程请求" }
] as const;

const wrapperCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 10
});

const cardCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorFillQuaternary
});

const headerCss = css({
  display: "flex",
  alignItems: "center",
  gap: 8
});

const emptyCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const removeCss = css({
  flexShrink: 0
});

function isDataSourceKind(value: unknown): value is DataSourceKind {
  return value === "static" || value === "remote";
}

/**
 * Whether a data source carries payload worth confirming before a destructive
 * kind switch discards it (the two kinds share no payload shape).
 */
function sourceHasPayload(source: FormDataSource): boolean {
  if (source.kind === "static") {
    return source.options.length > 0;
  }

  return source.request.resource.length > 0
    || source.request.action.length > 0
    || source.mapping !== undefined;
}

/**
 * Switch a data source's kind, preserving name / id and the inner payload when
 * unchanged so toggling the control does not discard work.
 */
function withKind(source: FormDataSource, kind: DataSourceKind): FormDataSource {
  if (kind === source.kind) {
    return source;
  }

  return kind === "static"
    ? {
        id: source.id,
        name: source.name,
        kind: "static",
        options: []
      }
    : {
        id: source.id,
        name: source.name,
        kind: "remote",
        request: { resource: "", action: "" }
      };
}

export interface FormDataSourcesPanelProps {
  dataSources: FormDataSource[];
  onChange: (next: FormDataSource[]) => void;
}

/**
 * Form-global data-source manager. A static source carries an inline option
 * list; a remote source carries an RPC request the host resolver runs. Selection
 * fields reference these by id (`{ kind: "ref", dataSourceId }`).
 *
 * Add and in-place edits flow through `onChange` (the drawer patches
 * `schema.dataSources`); deletion goes through the store's `removeDataSource`
 * so the references hanging off the schema are cleaned up with it.
 */
export function FormDataSourcesPanel({ dataSources, onChange }: FormDataSourcesPanelProps): ReactElement {
  const storeApi = useFormEditorStoreApi();

  const update = (id: string, next: FormDataSource): void => {
    onChange(dataSources.map(source => source.id === id ? next : source));
  };

  const remove = (id: string): void => {
    storeApi.getState().removeDataSource(id);
  };

  const add = (): void => {
    onChange([
      ...dataSources,
      {
        id: createId("DataSource"),
        name: "",
        kind: "static",
        options: []
      }
    ]);
  };

  return (
    <div css={wrapperCss}>
      {dataSources.length === 0 ? <span css={emptyCss}>暂无数据源，可被选择类字段以「引用数据源」方式复用</span> : null}

      {dataSources.map(source => (
        <DataSourceCard
          key={source.id}
          source={source}
          onRemove={() => remove(source.id)}
          onUpdate={next => update(source.id, next)}
        />
      ))}

      <Button block icon={<EditorIcon name="plus" />} type="dashed" onClick={add}>新增数据源</Button>
    </div>
  );
}

interface DataSourceCardProps {
  source: FormDataSource;
  onRemove: () => void;
  onUpdate: (next: FormDataSource) => void;
}

function DataSourceCard({
  source,
  onRemove,
  onUpdate
}: DataSourceCardProps): ReactElement {
  // The two kinds share no payload, so switching a configured source discards
  // work and is gated behind a confirmation; an unconfigured source switches
  // instantly.
  const kindSwitch = useConfirmableKindSwitch<DataSourceKind>({
    current: source.kind,
    needsConfirm: sourceHasPayload(source),
    commit: kind => onUpdate(withKind(source, kind))
  });

  return (
    <div css={cardCss}>
      <div css={headerCss}>
        <Input
          placeholder="数据源名称"
          value={source.name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onUpdate({ ...source, name: event.target.value })}
        />

        <Popconfirm
          cancelText="取消"
          okText="切换"
          open={kindSwitch.pendingKind !== null}
          title="切换类型将丢弃当前数据源配置"
          onCancel={kindSwitch.cancel}
          onConfirm={kindSwitch.confirm}
        >
          <Segmented
            options={[...KIND_OPTIONS]}
            value={source.kind}
            onChange={value => {
              if (isDataSourceKind(value)) {
                kindSwitch.requestKind(value);
              }
            }}
          />
        </Popconfirm>

        <Button
          aria-label="删除数据源"
          css={removeCss}
          icon={<EditorIcon name="trash-2" />}
          type="text"
          onClick={onRemove}
        />
      </div>

      {source.kind === "static"
        ? <OptionListEditor options={source.options} onChange={options => onUpdate({ ...source, options })} />
        : (
            <RemoteRequestFields
              mapping={source.mapping}
              request={source.request}
              onChange={(request, mapping) => onUpdate({
                ...source,
                request,
                mapping
              })}
            />
          )}
    </div>
  );
}
