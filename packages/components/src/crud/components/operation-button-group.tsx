import type { AnyObject } from "@vef-framework-react/shared";
import type { FC, ReactNode } from "react";

import type { CrudState } from "../store";

import { useShallow } from "@vef-framework-react/core";
import { isFunction } from "@vef-framework-react/shared";
import { memo } from "react";

import { Group } from "../../group";
import { useCrudStore } from "../store";

export interface OperationButtonGroupProps<
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TSelected = NoInfer<CrudState<AnyObject, TSearchValues, TSceneFormValues>>
> {
  selector?: (state: NoInfer<CrudState<AnyObject, TSearchValues, TSceneFormValues>>) => TSelected;
  children: ((state: NoInfer<TSelected>) => ReactNode) | ReactNode;
}

export const OperationButtonGroup = memo(<
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TSelected = NoInfer<CrudState<AnyObject, TSearchValues, TSceneFormValues>>
>({ selector, children }: OperationButtonGroupProps<TSearchValues, TSceneFormValues, TSelected>) => {
  const selected = useCrudStore(
    useShallow((state: CrudState<AnyObject, TSearchValues, TSceneFormValues>) => selector ? selector(state) : state as TSelected)
  );

  return (
    <Group justify="center">
      {isFunction(children) ? children(selected) : children}
    </Group>
  );
}) as (<
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TSelected = NoInfer<CrudState<AnyObject, TSearchValues, TSceneFormValues>>
>(props: OperationButtonGroupProps<TSearchValues, TSceneFormValues, TSelected>
) => ReactNode) & Pick<FC, "displayName">;

OperationButtonGroup.displayName = "OperationButtonGroup";
