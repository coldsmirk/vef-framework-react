import type { ApiResult, MutationFunction, MutationMeta } from "@vef-framework-react/core";
import type { AnyObject, Key, MaybeUndefined } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { ProTableProps } from "../../pro-table";
import type { CrudState } from "../store";

import { useMutation } from "@vef-framework-react/core";
import { isFunction } from "@vef-framework-react/shared";
import { memo, useEffect } from "react";

import { getRowKeyFn } from "../../pro-table";
import { useCrudStoreApi } from "../store";

interface MutationHolderProps<TRow extends AnyObject>
  extends Pick<ProTableProps<TRow, never>, "rowKey"> {
  mutationMeta?: (key: string) => MaybeUndefined<MutationMeta>;
  deleteMutationFn?: MutationFunction<ApiResult<unknown>, TRow>;
  deleteManyMutationFn?: MutationFunction<ApiResult<unknown>, TRow[]>;
}

function getMutationMeta<TRow extends AnyObject>(
  mutationMeta: MutationHolderProps<AnyObject>["mutationMeta"],
  mutationFn?: MutationFunction<ApiResult<unknown>, TRow>
): MutationMeta | undefined {
  if (isFunction(mutationMeta) && mutationFn) {
    return mutationMeta(mutationFn.key);
  }
}

export const MutationHolder = memo(<TRow extends AnyObject>({
  mutationMeta,
  deleteMutationFn,
  deleteManyMutationFn,
  rowKey
}: MutationHolderProps<TRow>) => {
  const crudStore = useCrudStoreApi<CrudState<TRow>>();
  const getRowKey = getRowKeyFn(rowKey as string | ((row: AnyObject) => Key));

  const { mutateAsync: deleteMutate } = useMutation({
    mutationKey: [deleteMutationFn?.key],
    mutationFn: deleteMutationFn,
    meta: getMutationMeta(mutationMeta, deleteMutationFn),
    onSuccess: (_, deletedRow) => {
      if (!getRowKey) {
        return;
      }

      const { selectedRowKeys, selectedRows } = crudStore.getState();
      const deletedKey = getRowKey(deletedRow);

      crudStore.setState({
        selectedRowKeys: selectedRowKeys.filter(key => String(key) !== deletedKey),
        selectedRows: selectedRows.filter(row => getRowKey(row) !== deletedKey)
      });
    }
  });

  const { mutateAsync: deleteManyMutate } = useMutation({
    mutationKey: [deleteManyMutationFn?.key],
    mutationFn: deleteManyMutationFn,
    meta: getMutationMeta(mutationMeta, deleteManyMutationFn),
    onSuccess: () => crudStore.getState().clearSelection()
  });

  useEffect(() => {
    crudStore.setState({
      delete: deleteMutate,
      deleteMany: deleteManyMutate
    });
  }, [crudStore, deleteMutate, deleteManyMutate]);

  return null;
}) as <TRow extends AnyObject>(props: MutationHolderProps<TRow>) => ReactNode;
