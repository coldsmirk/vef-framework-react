import type { SpaceProps } from "./props";

import { Space as SpaceInternal } from "antd";

export default function Space({
  children,
  size = "small",
  ...props
}: SpaceProps) {
  return <SpaceInternal size={size} {...props}>{children}</SpaceInternal>;
}
