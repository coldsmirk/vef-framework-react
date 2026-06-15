import type { LiteralUnion } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { SpinProps } from "../spin";

/**
 * The props of the Loader component.
 */
export interface LoaderProps {
  /**
   * The size of the loader.
   */
  size?: LiteralUnion<NonNullable<SpinProps["size"]>, number>;
  /**
   * The description of the loader.
   */
  description?: ReactNode;
  /**
   * The description font size.
   */
  descriptionSize?: number;
}
