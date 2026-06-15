import type { UseStore } from "@vef-framework-react/core";
import type { AnyObject } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { ActionButtonGroupProps, OperationButtonGroupProps } from "./components";
import type { CrudState } from "./store";

import { ActionButtonGroup, OperationButtonGroup } from "./components";
import { useSearchValues, useSelectedRows } from "./hooks";
import { useCrudStore } from "./store";

/**
 * Type representing the return value of createCrudKit
 */
export interface CrudKit<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject
> {
  useCrudStore: UseStore<CrudState<TRow, TSearchValues, TSceneFormValues>>;
  useSearchValues: () => TSearchValues;
  useSelectedRows: () => TRow[];
  OperationButtonGroup: <TSelected = NoInfer<CrudState<TRow, TSearchValues, TSceneFormValues>>>(
    props: OperationButtonGroupProps<TSearchValues, TSceneFormValues, TSelected>
  ) => ReactNode;
  ActionButtonGroup: <TSelected = NoInfer<CrudState<TRow, TSearchValues, TSceneFormValues>>>(
    props: ActionButtonGroupProps<TSearchValues, TSceneFormValues, TSelected>
  ) => ReactNode;
}

/**
 * Create a type-safe kit containing hooks and components for Crud with specific generic types.
 * This helper function eliminates the need to repeatedly specify generic parameters when using Crud-related utilities.
 */
export function createCrudKit<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject
>(): CrudKit<TRow, TSearchValues, TSceneFormValues> {
  return {
    useCrudStore: useCrudStore as UseStore<CrudState<TRow, TSearchValues, TSceneFormValues>>,
    useSearchValues: useSearchValues as () => TSearchValues,
    useSelectedRows: useSelectedRows as () => TRow[],
    OperationButtonGroup: OperationButtonGroup as <TSelected = NoInfer<CrudState<TRow, TSearchValues, TSceneFormValues>>>(
      props: OperationButtonGroupProps<TSearchValues, TSceneFormValues, TSelected>
    ) => ReactNode,
    ActionButtonGroup: ActionButtonGroup as <TSelected = NoInfer<CrudState<TRow, TSearchValues, TSceneFormValues>>>(
      props: ActionButtonGroupProps<TSearchValues, TSceneFormValues, TSelected>
    ) => ReactNode
  };
}
