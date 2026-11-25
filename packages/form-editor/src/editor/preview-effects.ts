import type { FormServices } from "../types";

import { defaultNotify } from "../runtime/action-executor";

/**
 * Adapt host services for the editor's live preview:
 * - `request` runs for real (when wired by the host) so lookups and remote
 * option sources can be exercised directly in preview.
 * - `notify` forwards to the host's sink or the framework default.
 * - `navigate` is replaced with an informational toast so testing a navigation
 * rule never leaves the designer.
 */
export function createPreviewServices(services?: FormServices): FormServices {
  const notify = services?.notify ?? defaultNotify;

  return {
    ...services?.request !== undefined && { request: services.request },
    ...services?.notify !== undefined && { notify: services.notify },
    navigate: to => notify("info", `（预览）跳转到：${to}`)
  };
}
