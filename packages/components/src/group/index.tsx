import type { PropsWithRef } from "../_base";
import type { GroupProps } from "./props";

import { Flex } from "../flex";

export function Group({
  ref,
  children,
  gap = "small",
  align = "center",
  ...props
}: PropsWithRef<HTMLDivElement, GroupProps>) {
  return (
    <Flex
      ref={ref}
      align={align}
      gap={gap}
      orientation="horizontal"
      {...props}
    >
      {children}
    </Flex>
  );
}

export { type GroupProps } from "./props";
