import type { MaybeNull } from "@vef-framework-react/shared";

import { createContext, use } from "react";

/**
 * Context for sharing grid state with grid items
 */
export interface GridContext {
  gridColumns: number;
  isCollapsed: boolean;
  setCollapsed: (isCollapsed?: boolean) => void;
}

const Context = createContext<MaybeNull<GridContext>>(null);

export const GridContextProvider = Context.Provider;

/**
 * Hook to get grid context value
 */
export function useGridContext(): GridContext {
  const context = use(Context);

  if (!context) {
    throw new Error("GridItem must be used as direct child of Grid");
  }

  return context;
}
