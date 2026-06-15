import type { AnyObject, Except, Key } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { CrudProps } from "../props";
import type { CrudState } from "../store";

import { useShallow } from "@vef-framework-react/core";
import { memo, useCallback } from "react";

import { FlexCard } from "../../flex-card";
import { ProTable } from "../../pro-table";
import { useQueryObserver } from "../hooks";
import { useCrudStore } from "../store";
import * as styles from "../styles";
import { Toolbar } from "./toolbar";

type MainProps<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TParams extends AnyObject
> = Except<
  CrudProps<TRow, TSearchValues, TSceneFormValues, TParams>,
  | "sceneDefaultFormValues"
  | "renderForm"
  | "defaultSearchValues"
  | "formMutationFns"
  | "beforeFormSubmit"
  | "afterFormSubmit"
  | "deleteMutationFn"
  | "deleteManyMutationFn"
  | "mutationMeta"
>;

export const Main = memo(<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TParams extends AnyObject
>({
  tableSize,
  tableColumns,
  toolbarActions,
  queryParams,
  basicSearch,
  advancedSearch,
  ...restProps
}: MainProps<TRow, TSearchValues, TSceneFormValues, TParams>) => {
  const {
    searchValues,
    selectedRowKeys,
    setSelectedRowKeys,
    setSelectedRows
  } = useCrudStore(
    useShallow((state: CrudState<TRow, TSearchValues, TSceneFormValues>) => {
      return {
        searchValues: state.searchValues,
        selectedRowKeys: state.selectedRowKeys,
        setSelectedRowKeys: state.setSelectedRowKeys,
        setSelectedRows: state.setSelectedRows
      };
    })
  );

  const tableRef = useQueryObserver();
  const mergedParams = { ...searchValues, ...queryParams } as TSearchValues & TParams;

  const handleSelectedRowKeysChange = useCallback((keys: Key[], rows: TRow[]) => {
    setSelectedRowKeys(keys);
    setSelectedRows(rows);
  }, [setSelectedRowKeys, setSelectedRows]);

  return (
    <FlexCard
      css={styles.main}
      title={(
        <Toolbar
          advancedSearch={advancedSearch}
          basicSearch={basicSearch}
          toolbarActions={toolbarActions}
        />
      )}
    >
      <ProTable<TRow, TSearchValues & TParams>
        {...restProps}
        ref={tableRef}
        columns={tableColumns}
        queryParams={mergedParams}
        selectedRowKeys={selectedRowKeys}
        size={tableSize}
        onSelectedRowKeysChange={handleSelectedRowKeysChange}
      />
    </FlexCard>
  );
}) as <
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TFilter extends AnyObject
>(props: MainProps<TRow, TSearchValues, TSceneFormValues, TFilter>
) => ReactNode;
