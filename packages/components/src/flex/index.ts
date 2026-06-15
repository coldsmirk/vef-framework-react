import type { Except, LiteralUnion } from "@vef-framework-react/shared";
import type { FlexProps as FlexPropsInternal } from "antd";
import type { SizeType } from "antd/es/config-provider/SizeContext";
import type { CSSProperties } from "react";

/**
 * The props for the flex component.
 */
export interface FlexProps extends Except<FlexPropsInternal, "gap"> {
  /**
   * The gap between the items.
   */
  gap?: LiteralUnion<SizeType, CSSProperties["gap"]>;
}

export { Flex } from "antd";
