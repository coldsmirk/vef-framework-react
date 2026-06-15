import { createContext, use } from "react";

const DisabledContext = createContext(false);

/**
 * Hook to access the disabled state from context.
 */
export function useDisabled(): boolean {
  return use(DisabledContext);
}

/**
 * Provider for the disabled state context.
 */
export const DisabledProvider = DisabledContext.Provider;
