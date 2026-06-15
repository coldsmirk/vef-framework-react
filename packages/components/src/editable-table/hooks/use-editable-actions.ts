import type { AnyObject } from "@vef-framework-react/shared";

import type { EditableTableState } from "../store";

import { get, isNullish } from "@vef-framework-react/shared";
import { useEffect, useRef } from "react";

import { showErrorMessage } from "../../_base/helpers/message";
import { useEditableTableStoreApi } from "../store";

/**
 * Minimal view of the draft form needed to drive row editing. Kept narrow so
 * the concrete `FormApi` (with its many validator generics) is assignable
 * without variance friction.
 */
interface DraftForm<TRow> {
  reset: (values?: TRow) => void;
  validateAllFields: (cause: "submit") => Promise<unknown[]>;
  state: { values: TRow };
}

interface UseEditableActionsParams<TRow extends AnyObject> {
  value: TRow[];
  onChange?: (value: TRow[]) => void;
  form: DraftForm<TRow>;
  getKey: (row: TRow) => string;
  rowKeyField: string | null;
  createRecord?: () => Partial<TRow>;
}

/**
 * Extract a human-readable message from a TanStack validation error, which may
 * be a plain string or an object carrying a `message` field.
 */
function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === "string") {
    return error || undefined;
  }

  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message?: unknown };
    return typeof message === "string" ? message : undefined;
  }

  return undefined;
}

/**
 * Owns the row-editing behavior and injects it into the store. The host holds
 * `value` / `onChange` / the draft form; cells and row actions invoke these
 * slots through the store. Latest `value`/`onChange` are read via refs so the
 * slots stay stable without re-injecting on every data change.
 */
export function useEditableActions<TRow extends AnyObject>({
  value,
  onChange,
  form,
  getKey,
  rowKeyField,
  createRecord
}: UseEditableActionsParams<TRow>): void {
  const storeApi = useEditableTableStoreApi();
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const tempIdRef = useRef(0);

  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    const startEdit: EditableTableState["startEdit"] = (rowKey, row) => {
      form.reset(row as TRow);
      storeApi.setState(state => {
        state.editingKey = rowKey;
      });
    };

    const cancel: EditableTableState["cancel"] = () => {
      storeApi.setState(state => {
        state.editingKey = null;
      });
    };

    const save: EditableTableState["save"] = async () => {
      const { editingKey } = storeApi.getState();

      if (editingKey === null) {
        return;
      }

      const errors = await form.validateAllFields("submit");

      if (errors.length > 0) {
        const message = errors.flat().map(error => getErrorMessage(error)).find(Boolean);
        showErrorMessage(message ?? "请检查表单填写是否正确");
        return;
      }

      const { values } = form.state;
      const next = valueRef.current.map(row => getKey(row) === editingKey ? { ...row, ...values } : row);

      onChangeRef.current?.(next);
      storeApi.setState(state => {
        state.editingKey = null;
      });
    };

    const addRow: EditableTableState["addRow"] = () => {
      const base = (createRecord?.() ?? {}) as TRow;
      const row = rowKeyField !== null && isNullish(get(base, rowKeyField))
        ? ({ ...base, [rowKeyField]: `__temp_${tempIdRef.current++}` } as TRow)
        : base;
      const next = [...valueRef.current, row];

      onChangeRef.current?.(next);
      form.reset(row);
      storeApi.setState(state => {
        state.editingKey = getKey(row);
      });
    };

    const deleteRow: EditableTableState["deleteRow"] = rowKey => {
      const next = valueRef.current.filter(row => getKey(row) !== rowKey);

      onChangeRef.current?.(next);
      storeApi.setState(state => {
        if (state.editingKey === rowKey) {
          state.editingKey = null;
        }
      });
    };

    storeApi.setState({
      addRow,
      cancel,
      deleteRow,
      save,
      startEdit
    });
  }, [storeApi, form, getKey, rowKeyField, createRecord]);
}
