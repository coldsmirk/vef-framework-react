import type { Plugin } from "vite";

import officePreset from "@file-viewer/preset-office";

export const FILE_VIEWER_OFFICE_EXTENSIONS = [...new Set(officePreset.renderers.flatMap(renderer => renderer.definitions?.flatMap(definition => definition.extensions) ?? []))];

export function fileViewerOfficeCapabilities(): Plugin {
  return {
    name: "vef:file-viewer-office-capabilities",
    config: () => {
      return {
        define: Object.fromEntries([["FILE_VIEWER_OFFICE_EXTENSIONS", JSON.stringify(FILE_VIEWER_OFFICE_EXTENSIONS)]])
      };
    }
  };
}
