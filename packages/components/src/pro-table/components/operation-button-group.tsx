import type { FC, ReactNode } from "react";

import type { ProTableState } from "../store";

import { useShallow } from "@vef-framework-react/core";
import { isFunction } from "@vef-framework-react/shared";
import { memo } from "react";

import { Group } from "../../group";
import { useProTableStore } from "../store";

export interface OperationButtonGroupProps<TSelected = NoInfer<ProTableState>> {
  selector?: (state: NoInfer<ProTableState>) => TSelected;
  children: ((state: NoInfer<TSelected>) => ReactNode) | ReactNode;
}

export const OperationButtonGroup = memo<OperationButtonGroupProps>(({ selector, children }) => {
  const selected = useProTableStore(
    useShallow((state: ProTableState) => selector ? selector(state) : state)
  );

  return (
    <Group justify="center">
      {isFunction(children) ? children(selected) : children}
    </Group>
  );
}) as (<TSelected = NoInfer<ProTableState>>(props: OperationButtonGroupProps<TSelected>) => ReactNode) & Pick<FC, "displayName">;

OperationButtonGroup.displayName = "OperationButtonGroup";
