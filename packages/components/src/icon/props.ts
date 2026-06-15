import type { Except } from "@vef-framework-react/shared";
import type { IconNode, LucideProps } from "lucide-react";
import type { ComponentType } from "react";

/**
 * The props of the Icon component
 */
type BaseIconProps = Except<LucideProps, "size" | "color" | "children">;

interface IconComponentProps extends BaseIconProps {
  /**
   * The component to render the icon
   */
  component: ComponentType<LucideProps>;
  iconNode?: never;
}

interface IconNodeProps extends BaseIconProps {
  component?: never;
  iconNode: IconNode;
}

export type IconProps = IconComponentProps | IconNodeProps;
