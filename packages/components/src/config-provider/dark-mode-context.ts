import { createContext, use } from "react";

const DarkModeContext = createContext<boolean>(false);

export const DarkModeProvider = DarkModeContext.Provider;

export function useIsDarkMode(): boolean {
  return use(DarkModeContext);
}
