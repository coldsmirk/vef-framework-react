import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";

import type { NodeKind } from "../types";

/**
 * UI specification for a node type. Structural rules (max count, deletability,
 * addability) live in `NODE_RULES` (constants.ts) so non-UI layers can read
 * them without importing component modules.
 */
export interface NodeSpecification {
  /**
   * Node kind identifier
   */
  type: NodeKind;
  /**
   * Display label
   */
  label: string;
  /**
   * Theme color for the node
   */
  color: string;
  /**
   * Icon component
   */
  icon: ComponentType<LucideProps>;
  /**
   * Icon badge treatment: `solid` fills the badge with the accent color so the
   * kind anchors the canvas visually (start/end); omitted means the default
   * soft tint.
   */
  badgeVariant?: "soft" | "solid";
  /**
   * React component to render the config panel when this node is selected
   */
  configPanel?: ComponentType<{ nodeId: string }>;
}
