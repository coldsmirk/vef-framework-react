import type { AnyObject } from "@vef-framework-react/shared";

import type { CrudProps } from "./props";

import { useMemo } from "react";

import { Main, MutationHolder, SceneForm } from "./components";
import { CrudStoreProvider } from "./store";

export function Crud<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TParams extends AnyObject = never
>({
  storageKey,
  defaultSearchValues,
  advancedSearch,
  sceneDefaultFormValues,
  renderForm,
  formComponent,
  formMutationFns,
  formActionsRenderers,
  beforeFormSubmit,
  afterFormSubmit,
  deleteMutationFn,
  deleteManyMutationFn,
  mutationMeta,
  rowSelection,
  rowKey,
  ...bodyProps
}: CrudProps<TRow, TSearchValues, TSceneFormValues, TParams>) {
  const initialState = useMemo(() => {
    const defaultSelectedRowKeys = rowSelection === true
      ? []
      : rowSelection?.defaultSelectedRowKeys ?? [];

    return {
      defaultSearchValues: defaultSearchValues as TSearchValues,
      sceneDefaultFormValues: sceneDefaultFormValues as Partial<TSceneFormValues>,
      selectedRowKeys: defaultSelectedRowKeys
    };
  }, [defaultSearchValues, sceneDefaultFormValues, rowSelection]);

  return (
    <CrudStoreProvider initialState={initialState} storageKey={storageKey}>
      <Main
        {...bodyProps}
        advancedSearch={advancedSearch}
        rowKey={rowKey}
        rowSelection={rowSelection}
      />

      <SceneForm
        afterFormSubmit={afterFormSubmit}
        beforeFormSubmit={beforeFormSubmit}
        formActionsRenderers={formActionsRenderers}
        formComponent={formComponent}
        formMutationFns={formMutationFns}
        mutationMeta={mutationMeta}
        renderForm={renderForm}
      />

      <MutationHolder
        deleteManyMutationFn={deleteManyMutationFn}
        deleteMutationFn={deleteMutationFn}
        mutationMeta={mutationMeta}
        rowKey={rowKey}
      />
    </CrudStoreProvider>
  );
}

export type {
  ActionButtonGroupProps as CrudActionButtonGroupProps,
  OperationButtonGroupProps as CrudOperationButtonGroupProps
} from "./components";
export { createCrudKit } from "./helpers";
export type { CrudKit } from "./helpers";
export type { CrudProps } from "./props";
export type * from "./types";
