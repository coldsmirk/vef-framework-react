import type { FragmentProps, ReactElement, ReactNode } from "react";

import { Fragment, isValidElement } from "react";

export function isFragment(node: ReactNode): node is ReactElement<FragmentProps> {
  return isValidElement(node) && node.type === Fragment;
}
