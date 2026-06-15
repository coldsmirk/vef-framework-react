import type { AnyObject } from "@vef-framework-react/shared";
import type { FC, ReactNode } from "react";

import type { CrudState } from "../store";

import { useShallow } from "@vef-framework-react/core";
import { isFunction } from "@vef-framework-react/shared";
import { memo } from "react";

import { useCrudStore } from "../store";

export interface ActionButtonGroupProps<
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TSelected = NoInfer<CrudState<AnyObject, TSearchValues, TSceneFormValues>>
> {
  selector?: (state: NoInfer<CrudState<AnyObject, TSearchValues, TSceneFormValues>>) => TSelected;
  children: ((state: NoInfer<TSelected>) => ReactNode) | ReactNode;
}

export const ActionButtonGroup = memo(<
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TSelected = NoInfer<CrudState<AnyObject, TSearchValues, TSceneFormValues>>
>({ selector, children }: ActionButtonGroupProps<TSearchValues, TSceneFormValues, TSelected>) => {
  const selected = useCrudStore(
    useShallow((state: CrudState<AnyObject, TSearchValues, TSceneFormValues>) => selector ? selector(state) : state as TSelected)
  );

  return isFunction(children) ? children(selected) : children;
}) as (<
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TSelected = NoInfer<CrudState<AnyObject, TSearchValues, TSceneFormValues>>
>(props: ActionButtonGroupProps<TSearchValues, TSceneFormValues, TSelected>
) => ReactNode) & Pick<FC, "displayName">;

ActionButtonGroup.displayName = "ActionButtonGroup";
