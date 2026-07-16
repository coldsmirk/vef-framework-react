import type { DynamicIconName } from "@vef-framework-react/components";

import { DynamicIcon } from "@vef-framework-react/components";

export interface FlowIconProps {
  /**
   * The stored kebab-case lucide icon name (from `IconPicker`). Absent or
   * empty renders nothing.
   */
  name?: string | null;
  size?: number;
}

/**
 * Renders a stored flow/category icon string. The single JSON-boundary
 * narrowing to `DynamicIconName` lives here (mirroring the starter's menu
 * icons) — `DynamicIcon` renders a fallback glyph for names it does not know,
 * so a stale stored value degrades instead of breaking.
 */
export function FlowIcon({ name, size = 16 }: FlowIconProps) {
  if (name === undefined || name === null || name === "") {
    return null;
  }

  return <DynamicIcon height={size} name={name as DynamicIconName} width={size} />;
}
