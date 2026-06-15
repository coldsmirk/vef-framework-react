import type { EditorState } from "./types";

import { createComponentStore } from "@vef-framework-react/core";

import { createFlowSlice } from "./flow-slice";
import { createGraphSlice } from "./graph-slice";
import { createHistorySlice } from "./history-slice";
import { createInteractionSlice } from "./interaction-slice";
import { createValidationSlice } from "./validation-slice";

export const {
  StoreProvider: EditorStoreProvider,
  useStoreApi: useEditorStoreApi,
  useStore: useEditorStore
} = createComponentStore<EditorState, Pick<EditorState, "readonly" | "nodes" | "edges">>(
  "ApprovalEditor",
  (...args) => {
    return {
      ...createGraphSlice(...args),
      ...createInteractionSlice(...args),
      ...createFlowSlice(...args),
      ...createValidationSlice(...args),
      ...createHistorySlice(...args)
    };
  }
);
