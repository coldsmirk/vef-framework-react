import type { PropsWithRef } from "../_base";
import type { CenterProps } from "./props";

import { Flex } from "../flex";

export function Center({
  ref,
  children,
  gap = "small",
  ...props
}: PropsWithRef<HTMLDivElement, CenterProps>) {
  return (
    <Flex
      ref={ref}
      align="center"
      gap={gap}
      justify="center"
      {...props}
    >
      {children}
    </Flex>
  );
}

export { type CenterProps } from "./props";
