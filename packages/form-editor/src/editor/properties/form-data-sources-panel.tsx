import type { ChangeEvent, ReactElement } from "react";

import type { FormDataSource, RemoteDataSource, RemoteDataSourceRequest, RemoteOptionMapping } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input, Modal, Popconfirm, ScrollArea, Segmented } from "@vef-framework-react/components";
import { isDeepEqual, omit } from "@vef-framework-react/shared";
import { useCallback, useEffect, useId, useRef, useState } from "react";

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
  dataListWrapperCss,
  MODAL_BODY_VIEWPORT_STYLE,
  modalErrorCss,
  modalFieldCss,
  modalFormCss,
  modalLabelCss,
  modalRequiredMarkCss
} from "./data-list";
import {
  cloneDataSource,
  collectDataSourceUsages,
  formatDataSourceRemovalLines,
  nextCopyName,
  summarizeDataSource
} from "./data-source-usage";
import { OptionListEditor } from "./option-editors";
import { RemoteOptionSourceEditor } from "./remote-option-source-editor";
import { useConfirmableKindSwitch } from "./use-confirmable-kind-switch";

type DataSourceKind = FormDataSource["kind"];

const KIND_OPTIONS = [
  { value: "static", label: "静态选项" },
  { value: "remote", label: "远程请求" }
] as const;

const MODAL_WIDTH = 680;

const MODAL_BODY_STYLE = {
  body: {
    padding: 0
  }
} as const;

const optionListSectionCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

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

interface DataSourceModalSession {
  mode: "create" | "edit";
  key: number;
  initial: FormDataSource;
}

export interface FormDataSourcesPanelProps {
  dataSources: FormDataSource[];
  onChange: (next: FormDataSource[]) => void;
  /**
   * Optional section title rendered above the list with the count badge and
   * top-right add trigger (used inside the sidebar's `数据` tab). When omitted
   * the panel renders a standalone full-width add button below the list.
   */
  title?: string;
}

/**
 * Form-global data-source manager. Lists each source as a compact two-line row
 * (name, one-line summary, reference count) and delegates creation and editing
 * to a draft-buffered modal so each confirmed edit writes back in one undo
 * step. Deletion goes through `removeDataSource` (after confirming affected
 * references when in use) so dangling refs are pruned with it.
 */
export function FormDataSourcesPanel({
  dataSources,
  onChange,
  title
}: FormDataSourcesPanelProps): ReactElement {
  const schema = useFormEditorStore(s => s.schema);
  const pendingEdit = useFormEditorStore(s => s.pendingDataEdit?.kind === "dataSource" ? s.pendingDataEdit : null);
  const storeApi = useFormEditorStoreApi();
  const apis = useDataSourceApis();

  const usages = collectDataSourceUsages(schema);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sessionCounterRef = useRef(0);
  const [session, setSession] = useState<DataSourceModalSession | null>(null);
  const [renderedSession, setRenderedSession] = useState<DataSourceModalSession | null>(null);

  if (session !== null && session !== renderedSession) {
    setRenderedSession(session);
  }

  const openEditModal = useCallback((source: FormDataSource): void => {
    sessionCounterRef.current += 1;
    setSession({
      mode: "edit",
      key: sessionCounterRef.current,
      initial: cloneDataSource(source)
    });
  }, []);

  const openCreateModal = (): void => {
    sessionCounterRef.current += 1;
    setSession({
      mode: "create",
      key: sessionCounterRef.current,
      initial: {
        id: createId("DataSource"),
        name: "",
        kind: "static",
        options: []
      }
    });
  };

  // Honor diagnostic jumps (`issue-location.ts`): scroll the target row into
  // view and open its edit modal immediately once the `数据` tab mounts.
  useEffect(() => {
    if (pendingEdit === null) {
      return;
    }

    storeApi.getState().clearPendingDataEdit();

    const target = dataSources.find(source => source.id === pendingEdit.id);

    if (target === undefined) {
      return;
    }

    rowRefs.current.get(target.id)?.scrollIntoView?.({ block: "nearest" });
    openEditModal(target);
  }, [pendingEdit, dataSources, storeApi, openEditModal]);

  const handleSave = (next: FormDataSource): void => {
    if (session?.mode === "create") {
      onChange([...dataSources, next]);
    } else {
      onChange(dataSources.map(source => source.id === next.id ? next : source));
    }

    setSession(null);
  };

  const handleDuplicate = (source: FormDataSource): void => {
    const existingNames = new Set(dataSources.map(item => item.name.trim()).filter(name => name.length > 0));
    const copy = cloneDataSource(source, {
      id: createId("DataSource"),
      name: nextCopyName(source.name, existingNames)
    });
    const index = dataSources.findIndex(item => item.id === source.id);
    const next = [...dataSources];

    next.splice(index + 1, 0, copy);
    onChange(next);
  };

  const handleDelete = (source: FormDataSource): void => {
    const usage = usages.get(source.id);

    if (usage === undefined || usage.total === 0) {
      storeApi.getState().removeDataSource(source.id);
      return;
    }

    const lines = formatDataSourceRemovalLines(usage);
    const displayName = source.name.trim();
    const dialogTitle = displayName.length > 0 ? `删除数据源「${displayName}」？` : "删除未命名数据源？";

    confirmDialog(dialogTitle, <DialogLines footnote={UNDOABLE_FOOTNOTE} lines={lines} />, {
      okType: "danger",
      okText: "删除",
      cancelText: "取消",
      detail: lines.join("\n"),
      onOk: () => storeApi.getState().removeDataSource(source.id)
    });
  };

  const setRowRef = (id: string) => (node: HTMLDivElement | null): void => {
    if (node === null) {
      rowRefs.current.delete(id);
    } else {
      rowRefs.current.set(id, node);
    }
  };

  const editingId = session?.mode === "edit" ? session.initial.id : null;

  return (
    <div css={dataListWrapperCss}>
      <DataListSectionHeader
        addLabel="新增数据源"
        count={dataSources.length}
        title={title}
        onAdd={openCreateModal}
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
                    rowRef={setRowRef(source.id)}
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
                    onEdit={() => openEditModal(source)}
                  />
                );
              })}
            </div>
          )}

      {title === undefined
        ? <Button block icon={<EditorIcon name="plus" />} type="dashed" onClick={openCreateModal}>新增数据源</Button>
        : null}

      {renderedSession === null
        ? null
        : (
            <DataSourceModal
              key={renderedSession.key}
              dataSources={dataSources}
              open={session !== null}
              session={renderedSession}
              onAfterClose={() => {
                if (session === null) {
                  setRenderedSession(null);
                }
              }}
              onClose={() => setSession(null)}
              onSave={handleSave}
            />
          )}
    </div>
  );
}

interface DataSourceModalProps {
  open: boolean;
  session: DataSourceModalSession;
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
  open,
  session
}: DataSourceModalProps): ReactElement {
  const nameInputId = useId();
  const nameInputRef = useRef<{ focus: () => void } | null>(null);
  const [draft, setDraft] = useState<FormDataSource>(() => cloneDataSource(session.initial));
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
    if (open && session.mode === "create") {
      nameInputRef.current?.focus();
    }
  }, [open, session.mode]);

  const kindSwitch = useConfirmableKindSwitch<DataSourceKind>({
    current: draft.kind,
    needsConfirm: sourceHasPayload(draft),
    commit: kind => setDraft(current => withKind(current, kind))
  });

  const requestClose = (): void => {
    if (!isDirty) {
      onClose();
      return;
    }

    confirmDialog("放弃未保存的修改？", "关闭后当前数据源的修改将不会保存。", {
      okType: "danger",
      okText: "放弃修改",
      cancelText: "继续编辑",
      onOk: onClose
    });
  };

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
    <Modal
      centered
      destroyOnHidden
      afterClose={onAfterClose}
      open={open}
      styles={MODAL_BODY_STYLE}
      title={session.mode === "create" ? "新增数据源" : "编辑数据源"}
      width={MODAL_WIDTH}
      footer={(
        <>
          <Button autoInsertSpace={false} onClick={requestClose}>取消</Button>
          <Button autoInsertSpace={false} type="primary" onClick={handleConfirm}>确定</Button>
        </>
      )}
      onCancel={requestClose}
    >
      <ScrollArea scrollbars="vertical" viewportStyle={MODAL_BODY_VIEWPORT_STYLE}>
        <div css={modalFormCss}>
          <div css={modalFieldCss}>
            <label css={modalLabelCss} htmlFor={nameInputId}>
              <span>名称</span>
              <span aria-hidden css={modalRequiredMarkCss}>*</span>
            </label>

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

            {nameError === null ? null : <span css={modalErrorCss} role="alert">{nameError}</span>}
          </div>

          <div css={modalFieldCss}>
            <span css={modalLabelCss}>来源类型</span>

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
          </div>

          {draft.kind === "static"
            ? (
                <div css={optionListSectionCss}>
                  <span css={modalLabelCss}>选项列表</span>

                  <OptionListEditor
                    allowBulkPaste
                    options={draft.options}
                    onChange={options => setDraft(current => current.kind === "static" ? { ...current, options } : current)}
                  />
                </div>
              )
            : (
                <RemoteOptionSourceEditor
                  mapping={draft.mapping}
                  request={draft.request}
                  onChange={(request, mapping) => setDraft(
                    current => current.kind === "remote" ? withRemotePayload(current, request, mapping) : current
                  )}
                />
              )}
        </div>
      </ScrollArea>
    </Modal>
  );
}
