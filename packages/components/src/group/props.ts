import type { Except, LiteralUnion } from "@vef-framework-react/shared";
import type { SizeType } from "antd/es/config-provider/SizeContext";
import type { CSSProperties } from "react";

import type { FlexProps } from "../flex";

/**
 * The props for the group component.
 */
export interface GroupProps extends Except<FlexProps, "vertical" | "orientation" | "gap"> {
  /**
   * The gap between the items.
   */
  gap?: LiteralUnion<SizeType, CSSProperties["gap"]>;
}
