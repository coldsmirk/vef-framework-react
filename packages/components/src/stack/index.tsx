import type { PropsWithRef } from "../_base";
import type { StackProps } from "./props";

import { Flex } from "../flex";

export function Stack({
  ref,
  children,
  gap = "small",
  ...props
}: PropsWithRef<HTMLDivElement, StackProps>) {
  return (
    <Flex
      ref={ref}
      gap={gap}
      orientation="vertical"
      {...props}
    >
      {children}
    </Flex>
  );
}

export { type StackProps } from "./props";
