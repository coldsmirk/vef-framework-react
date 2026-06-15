import type { NodeKind } from "../types";

import { globalCssVars } from "@vef-framework-react/components";

/**
 * Node accent colors — drive the selection ring and icon badge. All adaptive
 * globalCssVars tokens (var() references that shift with the dark algorithm) so
 * the accent tracks light/dark like the rest of the chrome; the color-mix
 * derivations in node-shell / AccentIconBadge accept var() inputs.
 *
 * Lives in styles/ (not constants.ts) so the pure domain layers — store,
 * serialization, validation — never pull the components package into their
 * module graph just to read structural rules.
 */
export const NODE_KIND_COLORS: Record<NodeKind, string> = {
  start: globalCssVars.colorSuccess,
  approval: globalCssVars.colorPrimary,
  handle: globalCssVars.purple,
  condition: globalCssVars.colorWarning,
  cc: globalCssVars.magenta,
  end: globalCssVars.colorError
};
