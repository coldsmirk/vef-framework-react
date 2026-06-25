import type { AppContext } from "./types";

import { createContext, use } from "react";

const AppContext = createContext<AppContext>({});
AppContext.displayName = "AppContext";

/**
 * Provider for the VEF app context.
 */
export const AppContextProvider = AppContext.Provider;

/**
 * Hook to access the VEF app context.
 */
export function useAppContext(): AppContext {
  return use(AppContext);
}
