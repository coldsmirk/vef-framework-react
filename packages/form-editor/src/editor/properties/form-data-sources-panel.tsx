import type { ChangeEvent, ReactElement } from "react";

import type { FormDataSource, RemoteDataSource, RemoteDataSourceRequest, RemoteOptionMapping } from "../../types";
import type { DataEntrySession } from "./use-data-entry-editor";

import { css } from "@emotion/react";
import { globalCssVars, Input, Popconfirm, Segmented } from "@vef-framework-react/components";
import { isDeepEqual, omit } from "@vef-framework-react/shared";
import { useEffect, useId, useRef, useState } from "react";

import { createId } from "../../engine/ids";
import { EditorIcon } from "../../icons";
import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { useDataSourceApis } from "../data-source-apis";
import { DialogLines, UNDOABLE_FOOTNOTE } from "../dialog-lines";
import { confirmDialog } from "../toolbar/notify";
import {
  DataListEmpty,
  dataListItemsCss,
  dataListMetaDotCss,
  dataListNameCss,
  dataListPrimaryLineCss,
  DataListRow,
  dataListSecondaryLineCss,
  DataListSectionHeader,
  dataListSummaryCss,
  dataListUnnamedCss,
  dataListUsageActiveCss,
  dataListUsageCss,
  dataListWarningCss,
  dataListWrapperCss
} from "./data-list";
import {
  collectDataSourceUsages,
  formatDataSourceRemovalLines,
  nextCopyName,
  summarizeDataSource
} from "./data-source-usage";
import { DraftField, DraftModal } from "./draft-modal";
import { OptionListEditor } from "./option-editors";
import { NodeReferenceScopeProvider } from "./reference-scope";
import { RemoteOptionSourceEditor } from "./remote-option-source-editor";
import { useConfirmableKindSwitch } from "./use-confirmable-kind-switch";
import { useDataEntryEditor } from "./use-data-entry-editor";

type DataSourceKind = FormDataSource["kind"];

const KIND_OPTIONS = [
  { value: "static", label: "静态选项" },
  { value: "remote", label: "远程请求" }
] as const;

const MODAL_WIDTH = 680;

// Stable empty fallback: a fresh array each render would re-run the editor's
// jump effect on every edit of a form without data sources.
const NO_DATA_SOURCES: FormDataSource[] = [];

const incompleteIconCss = css({
  display: "inline-flex",
  flexShrink: 0,
  color: globalCssVars.colorWarningText,

  "& > svg": {
    width: 12,
    height: 12
  }
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
    || Object.keys(source.request.params ?? {}).length > 0
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

/**
 * A remote source with a new request and mapping, omitting the mapping key
 * when there is none to store.
 */
function withRemotePayload(
  source: RemoteDataSource,
  request: RemoteDataSourceRequest,
  mapping: RemoteOptionMapping | undefined
): FormDataSource {
  return mapping === undefined
    ? { ...omit(source, ["mapping"]), request }
    : {
        ...source,
        request,
        mapping
      };
}

function createBlankDataSource(): FormDataSource {
  return {
    id: createId("DataSource"),
    name: "",
    kind: "static",
    options: []
  };
}

/**
 * Form-global data-source manager. Lists each source as a compact two-line row
 * (name, one-line summary, reference count) and edits it in a draft-buffered
 * modal, so each confirmed edit writes back in one undo step. Deletion goes
 * through `removeDataSource` (after confirming affected references when in use)
 * so dangling refs are pruned with it.
 */
export function FormDataSourcesPanel(): ReactElement {
  const schema = useFormEditorStore(s => s.schema);
  const storeApi = useFormEditorStoreApi();
  const apis = useDataSourceApis();
  const dataSources = schema.dataSources ?? NO_DATA_SOURCES;
  const usages = collectDataSourceUsages(schema);
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
    createBlank: createBlankDataSource,
    entries: dataSources,
    kind: "dataSource"
  });

  const handleSave = (next: FormDataSource): void => {
    storeApi.getState().saveDataSource(next);
    close();
  };

  const handleDuplicate = (source: FormDataSource): void => {
    const existingNames = new Set(dataSources.map(item => item.name.trim()).filter(name => name.length > 0));

    storeApi.getState().saveDataSource(
      {
        ...structuredClone(source),
        id: createId("DataSource"),
        name: nextCopyName(source.name, existingNames)
      },
      { after: source.id }
    );
  };

  const handleDelete = (source: FormDataSource): void => {
    const usage = usages.get(source.id);

    const remove = (): void => {
      storeApi.getState().removeDataSource(source.id);
      closeIfEditing(source.id);
    };

    if (usage === undefined || usage.total === 0) {
      remove();
      return;
    }

    const lines = formatDataSourceRemovalLines(usage);
    const displayName = source.name.trim();
    const dialogTitle = displayName.length > 0 ? `删除数据源「${displayName}」？` : "删除未命名数据源？";

    confirmDialog(dialogTitle, <DialogLines footnote={UNDOABLE_FOOTNOTE} lines={lines} />, {
      okType: "danger",
      okText: "删除",
      detail: lines.join("\n"),
      onOk: remove
    });
  };

  return (
    <div css={dataListWrapperCss}>
      <DataListSectionHeader
        addLabel="新增数据源"
        count={dataSources.length}
        title="数据源"
        onAdd={openCreate}
      />

      {dataSources.length === 0
        ? <DataListEmpty hint="选择类字段与固定行明细表可复用" title="暂无数据源" />
        : (
            <div aria-label="数据源列表" css={dataListItemsCss} role="list">
              {dataSources.map(source => {
                const trimmedName = source.name.trim();
                const unnamed = trimmedName.length === 0;
                const displayName = unnamed ? "未命名数据源" : trimmedName;
                const summary = summarizeDataSource(source, apis);
                const usageCount = usages.get(source.id)?.total ?? 0;

                return (
                  <DataListRow
                    key={source.id}
                    active={editingId === source.id}
                    deleteAriaLabel={`删除数据源 ${displayName}`}
                    duplicateAriaLabel={`复制数据源 ${displayName}`}
                    editAriaLabel={`编辑数据源 ${displayName}`}
                    rowRef={rowRef(source.id)}
                    primary={(
                      <span css={dataListPrimaryLineCss}>
                        <span css={[dataListNameCss, unnamed && dataListUnnamedCss]}>{displayName}</span>
                      </span>
                    )}
                    secondary={(
                      <span css={dataListSecondaryLineCss}>
                        {summary.incomplete
                          ? (
                              <span aria-hidden css={incompleteIconCss}>
                                <EditorIcon name="triangle-alert" />
                              </span>
                            )
                          : null}

                        <span
                          css={[dataListSummaryCss, summary.incomplete && dataListWarningCss]}
                          data-incomplete={summary.incomplete ? "true" : undefined}
                        >
                          {summary.text}
                        </span>

                        <span aria-hidden css={dataListMetaDotCss}>·</span>

                        <span css={[dataListUsageCss, usageCount > 0 && dataListUsageActiveCss]}>
                          {`${usageCount} 处使用`}
                        </span>
                      </span>
                    )}
                    onDelete={() => handleDelete(source)}
                    onDuplicate={() => handleDuplicate(source)}
                    onEdit={() => openEdit(source)}
                  />
                );
              })}
            </div>
          )}

      {session === null
        ? null
        : (
            <DataSourceModal
              key={session.key}
              dataSources={dataSources}
              session={session}
              onAfterClose={handleAfterClose}
              onClose={close}
              onSave={handleSave}
            />
          )}
    </div>
  );
}

interface DataSourceModalProps {
  session: DataEntrySession<FormDataSource>;
  dataSources: readonly FormDataSource[];
  onSave: (next: FormDataSource) => void;
  onClose: () => void;
  onAfterClose: () => void;
}

function DataSourceModal({
  dataSources,
  onAfterClose,
  onClose,
  onSave,
  session
}: DataSourceModalProps): ReactElement {
  const nameInputId = useId();
  const nameInputRef = useRef<{ focus: () => void } | null>(null);
  const [draft, setDraft] = useState(session.initial);
  const [nameEdited, setNameEdited] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isDirty = !isDeepEqual(draft, session.initial);
  const trimmedName = draft.name.trim();
  const isDuplicate = trimmedName.length > 0
    && dataSources.some(other => other.id !== draft.id && other.name.trim() === trimmedName);

  const nameError = isDuplicate
    ? "已存在同名数据源，请更换名称"
    : trimmedName.length === 0 && (submitAttempted || nameEdited)
      ? "请输入数据源名称"
      : null;

  // Focus the name input when creating a fresh source so the designer can
  // immediately type a name without an extra click.
  useEffect(() => {
    if (session.mode === "create") {
      nameInputRef.current?.focus();
    }
  }, [session.mode]);

  const kindSwitch = useConfirmableKindSwitch<DataSourceKind>({
    current: draft.kind,
    needsConfirm: sourceHasPayload(draft),
    commit: kind => setDraft(current => withKind(current, kind))
  });

  const handleConfirm = (): void => {
    setSubmitAttempted(true);

    if (trimmedName.length === 0 || isDuplicate) {
      nameInputRef.current?.focus();
      return;
    }

    const normalized: FormDataSource = { ...draft, name: trimmedName };

    if (session.mode === "edit" && isDeepEqual(normalized, session.initial)) {
      onClose();
      return;
    }

    onSave(normalized);
  };

  return (
    <DraftModal
      dirty={isDirty}
      open={session.open}
      title={session.mode === "create" ? "新增数据源" : "编辑数据源"}
      width={MODAL_WIDTH}
      onAfterClose={onAfterClose}
      onClose={onClose}
      onSubmit={handleConfirm}
    >
      <DraftField required error={nameError} htmlFor={nameInputId} label="名称">
        <Input
          ref={instance => {
            nameInputRef.current = instance;
          }}
          id={nameInputId}
          placeholder="例如：部门列表、审批状态"
          status={nameError === null ? undefined : "error"}
          value={draft.name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setNameEdited(true);
            setDraft(current => {
              return { ...current, name: event.target.value };
            });
          }}
        />
      </DraftField>

      <DraftField label="来源类型">
        <Popconfirm
          cancelText="取消"
          okText="切换"
          open={kindSwitch.pendingKind !== null}
          title="切换类型将丢弃当前数据源配置"
          onCancel={kindSwitch.cancel}
          onConfirm={kindSwitch.confirm}
        >
          <Segmented
            block
            options={[...KIND_OPTIONS]}
            value={draft.kind}
            onChange={value => {
              if (isDataSourceKind(value)) {
                kindSwitch.requestKind(value);
              }
            }}
          />
        </Popconfirm>
      </DraftField>

      {draft.kind === "static"
        ? (
            <DraftField label="选项列表">
              <OptionListEditor
                allowBulkPaste
                allowHierarchy
                options={draft.options}
                onChange={options => setDraft(current => current.kind === "static" ? { ...current, options } : current)}
              />
            </DraftField>
          )
        : (
            <NodeReferenceScopeProvider nodeId={null}>
              <RemoteOptionSourceEditor
                mapping={draft.mapping}
                request={draft.request}
                onChange={(request, mapping) => setDraft(
                  current => current.kind === "remote" ? withRemotePayload(current, request, mapping) : current
                )}
              />
            </NodeReferenceScopeProvider>
          )}
    </DraftModal>
  );
}
