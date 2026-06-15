import type * as LucideDynamic from "@lucide/icons/dynamic";
import type { Except } from "@vef-framework-react/shared";

import type { IconProps } from "../icon";

export type DynamicIconName = keyof typeof LucideDynamic.lucideDynamicIconImports;

/**
 * The props of the DynamicIcon component.
 */
export type DynamicIconProps = Except<IconProps, "component" | "iconNode"> & {
  /**
   * The name of the icon.
   */
  name: DynamicIconName;
};
