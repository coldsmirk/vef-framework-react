import type { ReactElement } from "react";

import type { FieldOption, SubformNode } from "../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { useEffect, useMemo } from "react";

import { isFixedSubform, readFixedRowItem } from "../engine/schema/subform";
import { resolveScopeValues } from "../runtime/resolve-scope-values";
import { useFieldOptions } from "./data-source-context";
import { errorTextCss, helperTextCss } from "./parts/field-shell";
import { blankSubformRow } from "./submit";

const statusBoxCss = css({
  padding: "8px 0"
});

interface FixedRowsFormLike {
  setFieldValue: (name: never, value: never) => void;
  store: { state: { values: Record<string, unknown> } };
}

export interface FixedSubformRowsState {
  loading: boolean;
  error: boolean;
  empty: boolean;
}

/**
 * Reconcile a fixed-row subform's current form rows against the latest
 * resolved item list. Returns `null` when the rows already match `options`
 * (same count, order, value, and label), avoiding redundant store writes.
 *
 * When the item list changes (e.g. a bound parameter on a remote source
 * changed), rows are rebuilt in the new source order while preserving any
 * user-entered template cells for items whose `value` survives.
 */
export function reconcileFixedRows(
  currentRows: Array<Record<string, unknown>>,
  options: readonly FieldOption[],
  subform: SubformNode,
  itemKey: string
): Array<Record<string, unknown>> | null {
  if (
    currentRows.length === options.length
    && options.every((option, index) => {
      const existing = readFixedRowItem(currentRows[index], itemKey);

      return existing !== undefined
        && String(existing.value) === String(option.value)
        && existing.label === option.label;
    })
  ) {
    return null;
  }

  const existingByValue = new Map<string, Record<string, unknown>>();

  for (const row of currentRows) {
    const existing = readFixedRowItem(row, itemKey);

    if (existing !== undefined) {
      existingByValue.set(String(existing.value), row);
    }
  }

  return options.map(option => {
    const prior = existingByValue.get(String(option.value));
    const base = prior ? { ...prior } : blankSubformRow(subform);

    return {
      ...base,
      [itemKey]: {
        value: option.value,
        label: option.label
      }
    };
  });
}

/**
 * Derive stable, unique React / EditableTable row keys for fixed-row records
 * from each row's snapshotted item value, so surviving rows retain their
 * component identity when a bound parameter re-resolves the item list.
 */
export function deriveFixedRowKeys(rows: readonly unknown[], itemKey: string): string[] {
  const counts = new Map<string, number>();

  return rows.map((row, index) => {
    const item = readFixedRowItem(row, itemKey);
    const base = item === undefined ? `fixed-idx-${index}` : `fixed-${String(item.value)}`;
    const seen = counts.get(base) ?? 0;

    counts.set(base, seen + 1);

    return seen === 0 ? base : `${base}#${seen}`;
  });
}

/**
 * Manage fixed-row seeding and bound-parameter re-resolution for a subform.
 *
 * - Non-fixed subforms are a no-op (returns `null`).
 * - Stored non-empty `initialValues` (detail view, approver view, resubmit)
 * lock the subform to those stored rows and pass `undefined` to
 * `useFieldOptions`, so no fetch or re-resolution ever runs.
 * - Empty initial values (new fill) resolve through `useFieldOptions`, seeding
 * rows in source order, reconciling on bound-parameter changes while keeping
 * surviving cells, and clearing to `[]` on error so `required` blocks submit.
 */
export function useFixedSubformRows(args: {
  arrayName: string;
  form: FixedRowsFormLike;
  initialValues: Record<string, unknown> | undefined;
  namePrefix: string;
  rowsEmpty: boolean;
  subform: SubformNode;
}): FixedSubformRowsState | null {
  const {
    arrayName,
    form,
    initialValues,
    namePrefix,
    rowsEmpty,
    subform
  } = args;
  const fixed = isFixedSubform(subform) ? subform.rows : undefined;
  const lockedToStoredRows = useMemo(() => {
    if (!fixed || !initialValues) {
      return false;
    }

    const scopeValues = resolveScopeValues(initialValues, namePrefix);
    const initialRows = scopeValues[subform.key];

    return Array.isArray(initialRows) && initialRows.length > 0;
  }, [fixed, initialValues, namePrefix, subform.key]);

  const {
    error,
    loading,
    options
  } = useFieldOptions(fixed && !lockedToStoredRows ? fixed.source : undefined);

  useEffect(() => {
    if (!fixed || lockedToStoredRows || loading) {
      return;
    }

    const scopeValues = resolveScopeValues(form.store.state.values, namePrefix);
    const rawRows = scopeValues[subform.key];
    const currentRows = (Array.isArray(rawRows) ? rawRows : []) as Array<Record<string, unknown>>;

    if (error) {
      if (currentRows.length > 0) {
        form.setFieldValue(arrayName as never, [] as never);
      }

      return;
    }

    const nextRows = reconcileFixedRows(currentRows, options, subform, fixed.itemKey);

    if (nextRows !== null) {
      form.setFieldValue(arrayName as never, nextRows as never);
    }
  }, [arrayName, error, fixed, form, loading, lockedToStoredRows, namePrefix, options, rowsEmpty, subform]);

  if (!fixed) {
    return null;
  }

  return {
    loading: !lockedToStoredRows && loading,
    error: !lockedToStoredRows && error,
    empty: !loading && !error && rowsEmpty
  };
}

/**
 * Inline status line shown inside a fixed-row subform when its item source is
 * loading, failed to resolve, or returned no items.
 */
export function FixedSubformStatusBanner({ status }: { status: FixedSubformRowsState | null }): ReactElement | null {
  if (!status) {
    return null;
  }

  if (status.loading) {
    return (
      <div css={statusBoxCss} role="status">
        <span css={helperTextCss}>正在加载行项目…</span>
      </div>
    );
  }

  if (status.error) {
    return (
      <div css={statusBoxCss} role="alert">
        <span css={errorTextCss}>行项目加载失败，请稍后重试</span>
      </div>
    );
  }

  if (status.empty) {
    return (
      <div css={statusBoxCss}>
        <span css={css([helperTextCss, { color: globalCssVars.colorTextTertiary }])}>暂无行项目</span>
      </div>
    );
  }

  return null;
}
