import { createComponentStore } from "@vef-framework-react/core";

/**
 * The state of the layout.
 */
export interface LayoutState {
  /**
   * Whether the search modal is visible.
   */
  isSearchVisible: boolean;
  /**
   * Set the search modal visibility.
   */
  setIsSearchVisible: (isSearchVisible: boolean) => void;
}

const { StoreProvider: LayoutStoreProvider, useStore: useLayoutStore } = createComponentStore<LayoutState, never>(
  "Layout",
  set => {
    return {
      isSearchVisible: false,
      setIsSearchVisible: isSearchVisible => {
        set(state => {
          state.isSearchVisible = isSearchVisible;
        });
      }
    };
  }
);

export { LayoutStoreProvider, useLayoutStore };
