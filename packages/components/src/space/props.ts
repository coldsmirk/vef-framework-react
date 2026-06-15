import type { Except, LiteralUnion } from "@vef-framework-react/shared";
import type { SpaceProps as SpacePropsInternal } from "antd";
import type { SizeType } from "antd/es/config-provider/SizeContext";

export type SpaceSize = LiteralUnion<SizeType, number>;

/**
 * The props for the space component.
 */
export interface SpaceProps extends Except<SpacePropsInternal, "size"> {
  /**
   * The size of the space.
   */
  size?: SpaceSize | [SpaceSize, SpaceSize];
}
