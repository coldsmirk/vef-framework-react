import type { EffectAction, EffectDispatchContext, LinkageAlertLevel } from "../types";

import { showErrorMessage, showInfoMessage, showSuccessMessage, showWarningMessage } from "@vef-framework-react/components";

/**
 * Realize each alert level with the framework's message API. The level enum maps
 * 1:1 to the four message helpers.
 */
const ALERT_BY_LEVEL: Record<LinkageAlertLevel, (text: string) => void> = {
  info: showInfoMessage,
  success: showSuccessMessage,
  warning: showWarningMessage,
  error: showErrorMessage
};

/**
 * Default effect dispatcher for the editor preview.
 *
 * The host-delegated effect actions — `alert` / `navigate` / `api_call` — are
 * benign no-ops in the bare runtime (`dispatchEffect` defaults to a no-op), so a
 * designer previewing a form would see nothing happen when one fires. This
 * realizes them visibly while designing: `alert` shows a message at its level,
 * and `navigate` / `api_call` (which can't really run in a preview) surface a
 * descriptive toast so the linkage is still observable. A host that wires its own
 * `evaluators.dispatchEffect` overrides this entirely — production keeps full
 * control over how these effects behave.
 */
export function previewDispatchEffect(action: EffectAction, context: EffectDispatchContext): void {
  // Only the host-delegated effects reach a dispatcher; `set_field` /
  // `set_variable` / `refresh_data_source` / `submit` / `reset` are handled
  // natively by the runtime and never arrive here.
  switch (action.type) {
    case "alert": {
      ALERT_BY_LEVEL[action.level ?? "info"](String(context.resolveValue(action.message) ?? ""));
      return;
    }

    case "navigate": {
      showInfoMessage(`（预览）跳转到：${String(context.resolveValue(action.to) ?? "")}`);
      return;
    }

    case "api_call": {
      showInfoMessage(`（预览）调用接口：${action.request.resource} · ${action.request.action}`);
    }
  }
}
