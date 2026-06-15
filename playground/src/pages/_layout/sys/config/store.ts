import { createComponentStore } from "@vef-framework-react/core";
import { EventEmitter } from "@vef-framework-react/shared";

interface ConfigPageEvents {
  submit: undefined;
}

interface ConfigPageState {
  eventEmitter: EventEmitter<ConfigPageEvents>;
  selectedCategory?: string;
  setSelectedCategory: (selectedCategory: string) => void;
  keyword?: string;
  setKeyword: (keyword: string) => void;
}

export const {
  StoreProvider: ConfigPageStoreProvider,
  useStore: useConfigPageStore
} = createComponentStore<ConfigPageState, never>(
  "ConfigPage",
  set => {
    return {
      eventEmitter: new EventEmitter(),
      setSelectedCategory: selectedCategory => {
        set(state => {
          state.selectedCategory = selectedCategory;
        });
      },
      setKeyword: keyword => {
        set(state => {
          state.keyword = keyword;
        });
      }
    };
  }
);
