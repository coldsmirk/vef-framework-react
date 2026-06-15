import type { FC, ReactNode } from "react";

import type { ProTableState } from "../store";

import { useShallow } from "@vef-framework-react/core";
import { isFunction } from "@vef-framework-react/shared";
import { memo } from "react";

import { useData } from "../context";
import { useProTableStore } from "../store";

export interface TableSubscriberProps<TSelected = NoInfer<ProTableState>, TRow = unknown> {
  selector?: (state: NoInfer<ProTableState> & { data: readonly TRow[] }) => TSelected;
  children: ((state: NoInfer<TSelected>) => ReactNode) | ReactNode;
}

export const TableSubscriber = memo<TableSubscriberProps>(({ selector, children }) => {
  const data = useData();
  const selected = useProTableStore(
    useShallow((state: ProTableState) => selector ? selector({ ...state, data }) : state)
  );

  return isFunction(children) ? children(selected) : children;
}) as (<TSelected = NoInfer<ProTableState>>(props: TableSubscriberProps<TSelected>) => ReactNode) & Pick<FC, "displayName">;

TableSubscriber.displayName = "ProTableSubscriber";
