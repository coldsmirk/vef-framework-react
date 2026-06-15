import type { Except, LiteralUnion } from "@vef-framework-react/shared";
import type { SizeType } from "antd/es/config-provider/SizeContext";
import type { CSSProperties } from "react";

import type { FlexProps } from "../flex";

/**
 * The props for the center component.
 */
export interface CenterProps extends Except<FlexProps, "vertical" | "gap" | "justify" | "align"> {
  /**
   * The gap between the items.
   */
  gap?: LiteralUnion<SizeType, CSSProperties["gap"]>;
}
