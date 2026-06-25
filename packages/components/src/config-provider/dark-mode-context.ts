import { createContext, use } from "react";

const DarkModeContext = createContext<boolean>(false);
DarkModeContext.displayName = "DarkModeContext";

export const DarkModeProvider = DarkModeContext.Provider;

export function useIsDarkMode(): boolean {
  return use(DarkModeContext);
}
