import { createContext, use } from "react";

const ViewportContext = createContext<number | null>(null);
ViewportContext.displayName = "ViewportContext";

/**
 * Hook to get the viewport height from Page component.
 * Must be used within Page component with scrollable prop set to true.
 */
export function useViewportHeight(): number {
  const context = use(ViewportContext);

  if (context === null) {
    throw new Error("useViewportHeight must be used within Page component with scrollable={true}");
  }

  return context;
}

export const ViewportProvider = ViewportContext.Provider;
