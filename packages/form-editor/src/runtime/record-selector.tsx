import type { TableColumn } from "@vef-framework-react/components";
import type { HTMLAttributes, ReactElement, KeyboardEvent as ReactKeyboardEvent } from "react";

import type { EffectAction, KeyedFormField, SelectRecordColumn } from "../types";

import { css } from "@emotion/react";
import { globalCssVars, Modal, ScrollArea, Table } from "@vef-framework-react/components";
import Popup from "antd-mobile/es/components/popup";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useMobileScopeContainer } from "../components/mobile/scope";
import { collectInferredSelectRecordColumns } from "../engine/linkage";
import { walkOwnPath } from "../engine/linkage/scope";
import { isRecord } from "../engine/validation";
import { useDevice } from "../store/engine-provider";

export interface RecordPickerRequest {
  records: ReadonlyArray<Record<string, unknown>>;
  columns: readonly SelectRecordColumn[];
  title?: string;
  signal: AbortSignal;
}

export type PickRecord = (request: RecordPickerRequest) => Promise<Record<string, unknown> | undefined>;

interface QueuedPickerRequest extends RecordPickerRequest {
  /**
   * Element that held focus when the picker opened, captured synchronously
   * before Modal / Popup mounts so focus can return to the triggering input
   * when the picker closes.
   */
  triggerElement: HTMLElement | null;
  resolve: (record: Record<string, unknown> | undefined) => void;
  cleanup: () => void;
}

/**
 * Imperative queue bridging async `select_record` steps to `<RecordSelectorHost>`
 * without lifting modal state into `FormRendererInner` (so opening the picker
 * re-renders only the host, never the form tree).
 */
export class RecordSelectorController {
  private readonly queue: QueuedPickerRequest[] = [];
  private readonly listeners = new Set<() => void>();

  pickRecord: PickRecord = request => {
    if (request.signal.aborted) {
      return Promise.resolve(undefined);
    }

    const triggerElement = typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    return new Promise<Record<string, unknown> | undefined>(resolve => {
      const entry: QueuedPickerRequest = {
        ...request,
        triggerElement,
        resolve,
        cleanup: () => {
          // Assigned below once `handleAbort` binds to `entry`.
        }
      };

      const handleAbort = (): void => {
        this.remove(entry, undefined);
      };

      entry.cleanup = () => {
        request.signal.removeEventListener("abort", handleAbort);
      };

      request.signal.addEventListener("abort", handleAbort, { once: true });
      this.queue.push(entry);
      this.notify();
    });
  };

  getActive = (): QueuedPickerRequest | null => this.queue[0] ?? null;

  subscribe = (listener: () => void): () => void => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private remove(entry: QueuedPickerRequest, result: Record<string, unknown> | undefined): void {
    const index = this.queue.indexOf(entry);

    if (index === -1) {
      return;
    }

    this.queue.splice(index, 1);
    entry.cleanup();
    entry.resolve(result);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  select(record: Record<string, unknown>): void {
    const active = this.queue[0];

    if (active !== undefined) {
      this.remove(active, record);
    }
  }

  dismiss(): void {
    const active = this.queue[0];

    if (active !== undefined) {
      this.remove(active, undefined);
    }
  }

  dismissAll(): void {
    while (this.queue.length > 0) {
      const entry = this.queue.shift();

      if (entry !== undefined) {
        entry.cleanup();
        entry.resolve(undefined);
      }
    }

    this.notify();
  }
}

/**
 * Normalize an arbitrary value into a list of candidate object records for
 * `select_record`:
 * - `null` / `undefined` / primitives → `[]`
 * - `Array` → plain object items only
 * - Framework paginated object (`{ items: Array }`) → plain object items in `items`
 * - Any other plain object → single-element list `[raw]`
 */
export function normalizeRecordList(raw: unknown): Array<Record<string, unknown>> {
  if (raw === null || raw === undefined) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.filter(isRecord);
  }

  if (isRecord(raw)) {
    if (Array.isArray(raw.items)) {
      return raw.items.filter(isRecord);
    }

    return [raw];
  }

  return [];
}

/**
 * Read one cell path (flat key or dot-separated segments) from a candidate
 * record using prototype-safe own-property traversal.
 */
export function readRecordCellValue(record: Record<string, unknown>, path: string): unknown {
  if (path.length === 0) {
    return record;
  }

  return walkOwnPath(record, path.split("."));
}

function collectScalarKeysFromRecord(
  record: Record<string, unknown>,
  seenKeys: Set<string>,
  scalarKeys: string[]
): void {
  for (const [key, value] of Object.entries(record)) {
    if (seenKeys.has(key)) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      seenKeys.add(key);
      scalarKeys.push(key);
    }
  }
}

/**
 * Derive display columns for a `select_record` dialog:
 * 1. Explicit `action.columns`, when configured.
 * 2. Paths referenced from `$steps.<output>.*` in subsequent `set_fields`
 * actions of the same rule, labelled by each target field's label.
 * 3. Fallback: scalar own-property keys of the candidate records.
 */
export function inferSelectRecordColumns(
  action: Extract<EffectAction, { type: "select_record" }>,
  remainingActions: readonly EffectAction[],
  records: ReadonlyArray<Record<string, unknown>>,
  scopeFields: ReadonlyMap<string, KeyedFormField>
): SelectRecordColumn[] {
  if (Array.isArray(action.columns) && action.columns.length > 0) {
    const explicit = action.columns
      .filter(column => isRecord(column) && typeof column.path === "string" && column.path.length > 0)
      .map(column => {
        return {
          path: column.path,
          label: typeof column.label === "string" && column.label.length > 0 ? column.label : column.path
        };
      });

    if (explicit.length > 0) {
      return explicit;
    }
  }

  const inferred = typeof action.output === "string"
    ? collectInferredSelectRecordColumns(action.output, remainingActions, scopeFields)
    : [];

  if (inferred.length > 0) {
    return inferred;
  }

  const scalarKeys: string[] = [];
  const seenKeys = new Set<string>();

  for (const record of records) {
    collectScalarKeysFromRecord(record, seenKeys, scalarKeys);
  }

  if (scalarKeys.length > 0) {
    return scalarKeys.map(key => {
      return { path: key, label: key };
    });
  }

  return [{ path: "", label: "记录" }];
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const ACTIVE_ROW_CLASS = "vef-record-selector-row-active";

const pcBodyCss = css({
  outline: "none"
});

const pcScrollAreaCss = css({
  // Disable antd Table's own `.vef-table-content` overflow so `ScrollArea` is
  // the single scroll region for long/wide lists, and pin the header against
  // the ScrollArea viewport. The table sets that overflow inline, which only
  // `!important` can override.
  "& .vef-table-content": {
    overflow: "visible !important"
  },
  "& .vef-table-thead > tr > th": {
    position: "sticky",
    top: 0,
    zIndex: 2
  },
  // A date or a name broken over two lines is slow to scan: the dialog widens to
  // the columns, a long text is cut, and past the window the list scrolls sideways.
  "& .vef-table-thead > tr > th, & .vef-table-tbody > tr > td": {
    maxWidth: 320,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  "& .vef-table-tbody > tr": {
    cursor: "pointer"
  },
  [`& .vef-table-tbody > tr.${ACTIVE_ROW_CLASS} > td`]: {
    backgroundColor: globalCssVars.colorPrimaryBg
  },
  [`& .vef-table-tbody > tr.${ACTIVE_ROW_CLASS}:hover > td`]: {
    backgroundColor: globalCssVars.colorPrimaryBgHover
  }
});

const PC_MODAL_WIDTH = "fit-content";

const PC_MODAL_STYLE = {
  minWidth: "min(520px, calc(100vw - 32px))"
} as const;

// The dialog sizes to its columns, so their width has to reach it: the framework
// table keeps its own from its host by default.
const PC_TABLE_STYLE = {
  contain: "none"
} as const;

const PC_VIEWPORT_STYLE = {
  maxHeight: "60vh"
} as const;

const mobileContainerCss = css({
  display: "flex",
  flexDirection: "column",
  maxHeight: "70vh",
  outline: "none"
});

const mobileHeaderCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 16px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  flexShrink: 0
});

const mobileTitleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const mobileCloseCss = css({
  flexShrink: 0,
  padding: "2px 6px",
  border: "none",
  background: "transparent",
  font: "inherit",
  color: globalCssVars.colorTextSecondary,
  cursor: "pointer"
});

const mobileScrollAreaCss = css({
  flex: 1,
  minHeight: 0
});

const MOBILE_VIEWPORT_STYLE = {
  maxHeight: "55vh"
} as const;

const mobileListCss = css({
  padding: "8px 12px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 8
});

const mobileCardCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  width: "100%",
  padding: "10px 12px",
  textAlign: "left",
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgContainer,
  cursor: "pointer",
  transition: `background-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
});

const mobileCardActiveCss = css({
  borderColor: globalCssVars.colorPrimaryBorder,
  background: globalCssVars.colorPrimaryBg
});

const mobilePrimaryCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText
});

const mobileMetaCss = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "4px 12px",
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextSecondary
});

const mobileMetaLabelCss = css({
  color: globalCssVars.colorTextTertiary,
  marginRight: 4
});

const MODAL_FOCUSABLE = {
  focusTriggerAfterClose: false
} as const;

const MOBILE_POPUP_BODY_STYLE = {
  display: "flex",
  flexDirection: "column" as const,
  maxHeight: "70vh",
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  overflow: "hidden" as const
};

interface RecordRow {
  rowKey: number;
  record: Record<string, unknown>;
}

/**
 * Whether `target` sits inside a non-option interactive button (such as a
 * modal/popup Close button) whose native Enter activation must not be hijacked
 * into selecting a record.
 */
function isNonOptionButton(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const button = target.closest("button");

  return button !== null && button.dataset.recordOption === undefined;
}

/**
 * Renders the active `select_record` dialog for the enclosing `FormRenderer`:
 * an antd `Modal` hosting the framework `Table` inside a single `ScrollArea`
 * on PC, or an antd-mobile `Popup` card list contained inside the phone
 * preview via `useMobileScopeContainer` on mobile.
 *
 * - Keeps the Modal / Popup mounted while closing (`open` / `visible` driven
 * by `active !== null`) so native close transitions play before `afterClose`
 * clears cached content.
 * - Scopes ArrowUp / ArrowDown / Enter / Escape keyboard navigation inside the
 * picker's own focus container (never hijacking Enter on the Close button),
 * scrolls the active row into view, and restores focus to the triggering
 * element on close.
 */
export function RecordSelectorHost({ controller }: { controller: RecordSelectorController }): ReactElement | null {
  const device = useDevice();
  const getMobileContainer = useMobileScopeContainer();
  const active = useSyncExternalStore(controller.subscribe, controller.getActive, () => null);
  const [rendered, setRendered] = useState<QueuedPickerRequest | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const pcContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileContainerRef = useRef<HTMLDivElement | null>(null);
  const isOpenRef = useRef(false);
  const wasOpenRef = useRef(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  isOpenRef.current = active !== null;

  // Focus the picker container as soon as the Portal mounts it — Portal
  // children mount asynchronously after `RecordSelectorHost`'s initial effect,
  // and `afterOpenChange` waits for CSS enter animations to complete.
  const setPcContainer = useCallback((node: HTMLDivElement | null) => {
    pcContainerRef.current = node;

    if (node !== null && isOpenRef.current) {
      node.focus({ preventScroll: true });
    }
  }, []);

  const setMobileContainer = useCallback((node: HTMLDivElement | null) => {
    mobileContainerRef.current = node;

    if (node !== null && isOpenRef.current) {
      node.focus({ preventScroll: true });
    }
  }, []);

  if (active !== null && active !== rendered) {
    setRendered(active);
  }

  // Reset highlighted row whenever a new picker request becomes active, and
  // manage focus entry / restoration cleanly across open ↔ close transitions.
  useEffect(() => {
    if (active !== null) {
      if (!wasOpenRef.current) {
        wasOpenRef.current = true;
        restoreFocusRef.current = active.triggerElement;
      }

      setActiveIndex(0);

      const container = (device === "mobile" ? mobileContainerRef : pcContainerRef).current;

      container?.focus({ preventScroll: true });

      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const target = restoreFocusRef.current;

      restoreFocusRef.current = null;

      if (target?.isConnected && !target.hasAttribute("disabled")) {
        target.focus({ preventScroll: true });
      }
    }
  }, [active, device]);

  // Keep the highlighted row visible as ArrowUp / ArrowDown moves through a
  // long scrollable list.
  useEffect(() => {
    if (active === null) {
      return;
    }

    const container = (device === "mobile" ? mobileContainerRef : pcContainerRef).current;
    const targetIndex = String(activeIndex);

    if (container !== null) {
      for (const rowEl of container.querySelectorAll<HTMLElement>("[data-record-index]")) {
        if (rowEl.dataset.recordIndex === targetIndex) {
          rowEl.scrollIntoView?.({ block: "nearest" });

          break;
        }
      }
    }
  }, [active, activeIndex, device]);

  // Dismiss any remaining pending pickers if the form unmounts.
  useEffect(() => () => {
    controller.dismissAll();
  }, [controller]);

  const tableColumns = useMemo<Array<TableColumn<RecordRow>>>(
    () => (rendered?.columns ?? []).map(column => {
      return {
        key: column.path,
        title: column.label,
        onCell: (row: RecordRow) => {
          return { title: formatCellValue(readRecordCellValue(row.record, column.path)) };
        },
        render: (_value: unknown, row: RecordRow) => formatCellValue(readRecordCellValue(row.record, column.path))
      };
    }),
    [rendered]
  );

  const tableData = useMemo<RecordRow[]>(
    () => (rendered?.records ?? []).map((record, index) => {
      return {
        rowKey: index,
        record
      };
    }),
    [rendered]
  );

  if (rendered === null) {
    return null;
  }

  const isOpen = active !== null;
  const title = rendered.title && rendered.title.length > 0 ? rendered.title : "请选择记录";

  const handleAfterClose = (): void => {
    if (controller.getActive() === null) {
      setRendered(null);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (!isOpen || rendered.records.length === 0 || event.nativeEvent.isComposing) {
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(current => (current + 1) % rendered.records.length);

        break;
      }

      case "ArrowUp": {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(current => (current - 1 + rendered.records.length) % rendered.records.length);

        break;
      }

      case "Enter": {
        // Leave Enter on Close / non-option buttons alone so activating them
        // dismisses the picker rather than selecting a record.
        if (isNonOptionButton(event.target)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const selected = rendered.records[activeIndex];

        if (selected !== undefined) {
          controller.select(selected);
        }

        break;
      }

      case "Escape": {
        event.preventDefault();
        event.stopPropagation();
        controller.dismiss();

        break;
      }
    // No default
    }
  };

  if (device === "mobile") {
    const [primaryColumn, ...secondaryColumns] = rendered.columns;

    return (
      <Popup
        closeOnMaskClick
        destroyOnClose
        afterClose={handleAfterClose}
        afterShow={() => mobileContainerRef.current?.focus({ preventScroll: true })}
        bodyStyle={MOBILE_POPUP_BODY_STYLE}
        getContainer={getMobileContainer}
        position="bottom"
        visible={isOpen}
        onClose={() => controller.dismiss()}
      >
        <div
          ref={setMobileContainer}
          css={mobileContainerCss}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          <div css={mobileHeaderCss}>
            <span css={mobileTitleCss}>{title}</span>

            <button
              aria-label="关闭"
              css={mobileCloseCss}
              type="button"
              onClick={() => controller.dismiss()}
            >
              关闭
            </button>
          </div>

          <ScrollArea css={mobileScrollAreaCss} scrollbars="vertical" viewportStyle={MOBILE_VIEWPORT_STYLE}>
            <div aria-label={title} css={mobileListCss} role="listbox">
              {rendered.records.map((record, index) => {
                const isSelected = index === activeIndex;

                return (
                  <button
                    key={index}
                    aria-selected={isSelected}
                    css={[mobileCardCss, isSelected && mobileCardActiveCss]}
                    data-active={isSelected ? "true" : undefined}
                    data-record-index={index}
                    data-record-option="true"
                    role="option"
                    type="button"
                    onClick={() => controller.select(record)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {primaryColumn === undefined
                      ? null
                      : (
                          <div css={mobilePrimaryCss}>
                            {formatCellValue(readRecordCellValue(record, primaryColumn.path))}
                          </div>
                        )}

                    {secondaryColumns.length > 0
                      ? (
                          <div css={mobileMetaCss}>
                            {secondaryColumns.map(column => (
                              <span key={column.path}>
                                <span css={mobileMetaLabelCss}>
                                  {column.label}
                                  :
                                </span>

                                {formatCellValue(readRecordCellValue(record, column.path))}
                              </span>
                            ))}
                          </div>
                        )
                      : null}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </Popup>
    );
  }

  return (
    <Modal
      destroyOnHidden
      keyboard
      afterClose={handleAfterClose}
      focusable={MODAL_FOCUSABLE}
      footer={null}
      open={isOpen}
      style={PC_MODAL_STYLE}
      title={title}
      width={PC_MODAL_WIDTH}
      afterOpenChange={open => {
        const container = pcContainerRef.current;

        if (open && container !== null && !container.closest("[role='dialog']")?.contains(document.activeElement)) {
          container.focus({ preventScroll: true });
        }
      }}
      onCancel={() => controller.dismiss()}
    >
      <div
        ref={setPcContainer}
        aria-label={title}
        css={pcBodyCss}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <ScrollArea css={pcScrollAreaCss} scrollbars="both" type="auto" viewportStyle={PC_VIEWPORT_STYLE}>
          <Table<RecordRow>
            columns={tableColumns}
            dataSource={tableData}
            flexHeight={false}
            pagination={false}
            rowClassName={(_record, index) => index === activeIndex ? ACTIVE_ROW_CLASS : ""}
            rowKey="rowKey"
            size="small"
            style={PC_TABLE_STYLE}
            onRow={(row, rowIndex = 0) => {
              const isSelected = rowIndex === activeIndex;

              return {
                "aria-current": isSelected ? "true" : undefined,
                "data-active": isSelected ? "true" : undefined,
                "data-record-index": rowIndex,
                onClick: () => controller.select(row.record),
                onMouseEnter: () => setActiveIndex(rowIndex)
              } as HTMLAttributes<HTMLTableRowElement>;
            }}
          />
        </ScrollArea>
      </div>
    </Modal>
  );
}
