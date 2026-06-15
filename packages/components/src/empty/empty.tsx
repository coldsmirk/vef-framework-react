import type { EmptyProps } from "antd";

import { Empty as EmptyInternal } from "antd";

export default function Empty({
  image = EmptyInternal.PRESENTED_IMAGE_SIMPLE,
  ...props
}: EmptyProps) {
  return <EmptyInternal image={image} {...props} />;
}
