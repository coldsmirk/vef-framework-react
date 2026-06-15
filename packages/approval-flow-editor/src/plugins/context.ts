import type { EditorPlugins } from "./types";

import { createContext, use } from "react";

export const EditorPluginsContext = createContext<EditorPlugins>({});

export function useEditorPlugins() {
  return use(EditorPluginsContext);
}
