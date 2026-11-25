import type { ReactElement } from "react";

import type { EffectAction, KeyedFormField, SelectRecordColumn } from "../types";

import { css } from "@emotion/react";
import { globalCssVars, Modal } from "@vef-framework-react/components";
import Popup from "antd-mobile/es/components/popup";
import { useEffect, useState, useSyncExternalStore } from "react";

import { useMobileScopeContainer } from "../components/mobile/scope";
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

    return new Promise<Record<string, unknown> | undefined>(resolve => {
      const entry: QueuedPickerRequest = {
        ...request,
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

function collectInferredColumnsFromAssignments(
  assignments: readonly unknown[],
  prefix: string,
  scopeFields: ReadonlyMap<string, KeyedFormField>,
  seen: Set<string>,
  inferred: SelectRecordColumn[]
): void {
  for (const assignment of assignments) {
    if (
      !isRecord(assignment)
      || !isRecord(assignment.value)
      || assignment.value.kind !== "reference"
      || typeof assignment.value.path !== "string"
      || !assignment.value.path.startsWith(prefix)
    ) {
      continue;
    }

    const subPath = assignment.value.path.slice(prefix.length);

    if (subPath.length === 0 || seen.has(subPath)) {
      continue;
    }

    seen.add(subPath);
    const target = typeof assignment.targetKey === "string" ? scopeFields.get(assignment.targetKey) : undefined;
    const label = target?.label || (typeof assignment.targetKey === "string" && assignment.targetKey.length > 0 ? assignment.targetKey : subPath);

    inferred.push({ path: subPath, label });
  }
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

  if (typeof action.output === "string" && action.output.length > 0) {
    const prefix = `$steps.${action.output}.`;
    const seen = new Set<string>();
    const inferred: SelectRecordColumn[] = [];

    for (const next of remainingActions) {
      if (isRecord(next) && next.type === "set_fields" && Array.isArray(next.assignments)) {
        collectInferredColumnsFromAssignments(next.assignments, prefix, scopeFields, seen, inferred);
      }
    }

    if (inferred.length > 0) {
      return inferred;
    }
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

const tableScrollCss = css({
  maxHeight: "60vh",
  overflowY: "auto",
  overflowX: "auto"
});

const tableCss = css({
  width: "100%",
  borderCollapse: "collapse",
  fontSize: globalCssVars.fontSize
});

const thCss = css({
  position: "sticky",
  top: 0,
  zIndex: 1,
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary,
  background: globalCssVars.colorFillQuaternary,
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  whiteSpace: "nowrap"
});

const rowCss = css({
  cursor: "pointer",
  transition: `background-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover": {
    background: globalCssVars.colorFillTertiary
  }
});

const activeRowCss = css({
  background: globalCssVars.colorPrimaryBg,

  "&:hover": {
    background: globalCssVars.colorPrimaryBgHover
  }
});

const tdCss = css({
  padding: "9px 12px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  color: globalCssVars.colorText
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

const mobileListCss = css({
  flex: 1,
  minHeight: 0,
  maxHeight: "60vh",
  overflowY: "auto",
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

const MOBILE_POPUP_BODY_STYLE = {
  display: "flex",
  flexDirection: "column" as const,
  maxHeight: "70vh",
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  overflow: "hidden" as const
};

/**
 * Renders the active `select_record` dialog for the enclosing `FormRenderer`:
 * an antd `Modal` table on PC, or an antd-mobile `Popup` card list contained
 * inside the phone preview via `useMobileScopeContainer` on mobile. Supports
 * ArrowUp / ArrowDown / Enter / Escape keyboard navigation on both devices.
 */
export function RecordSelectorHost({ controller }: { controller: RecordSelectorController }): ReactElement | null {
  const device = useDevice();
  const getMobileContainer = useMobileScopeContainer();
  const active = useSyncExternalStore(controller.subscribe, controller.getActive, () => null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset highlighted row whenever a new picker request becomes active.
  useEffect(() => {
    setActiveIndex(0);
  }, [active]);

  // Dismiss any remaining pending pickers if the form unmounts.
  useEffect(() => () => {
    controller.dismissAll();
  }, [controller]);

  // Capture-phase window keyboard navigation while the picker is open so
  // ArrowUp / ArrowDown / Enter / Escape belong exclusively to the modal/popup
  // and never leak down into an underlying focused input or button.
  useEffect(() => {
    if (active === null || active.records.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing) {
        return;
      }

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          event.stopPropagation();
          setActiveIndex(current => (current + 1) % active.records.length);

          break;
        }

        case "ArrowUp": {
          event.preventDefault();
          event.stopPropagation();
          setActiveIndex(current => (current - 1 + active.records.length) % active.records.length);

          break;
        }

        case "Enter": {
          event.preventDefault();
          event.stopPropagation();

          const selected = active.records[activeIndex];

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

    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [active, activeIndex, controller]);

  if (active === null) {
    return null;
  }

  const title = active.title && active.title.length > 0 ? active.title : "请选择记录";

  if (device === "mobile") {
    const [primaryColumn, ...secondaryColumns] = active.columns;

    return (
      <Popup
        closeOnMaskClick
        destroyOnClose
        visible
        bodyStyle={MOBILE_POPUP_BODY_STYLE}
        getContainer={getMobileContainer}
        position="bottom"
        onClose={() => controller.dismiss()}
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

        <div aria-label={title} css={mobileListCss} role="listbox">
          {active.records.map((record, index) => {
            const isSelected = index === activeIndex;

            return (
              <button
                key={index}
                aria-selected={isSelected}
                css={[mobileCardCss, isSelected && mobileCardActiveCss]}
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
      </Popup>
    );
  }

  return (
    <Modal
      destroyOnHidden
      open
      footer={null}
      keyboard={false}
      title={title}
      width={640}
      onCancel={() => controller.dismiss()}
    >
      <div css={tableScrollCss}>
        <table aria-label={title} css={tableCss} role="listbox">
          <thead>
            <tr>
              {active.columns.map(column => (
                <th key={column.path} css={thCss} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {active.records.map((record, index) => {
              const isSelected = index === activeIndex;

              return (
                <tr
                  key={index}
                  aria-selected={isSelected}
                  css={[rowCss, isSelected && activeRowCss]}
                  role="option"
                  onClick={() => controller.select(record)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {active.columns.map(column => (
                    <td key={column.path} css={tdCss}>
                      {formatCellValue(readRecordCellValue(record, column.path))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
