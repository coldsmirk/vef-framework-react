import type { IconNode } from "lucide-react";

import type { DynamicIconName, DynamicIconProps } from "./props";

import { lucideIconNames } from "@lucide/icons/dynamic";
import { useEffect, useState } from "react";

import { Icon } from "../icon";
import { getCachedIconNode, loadIconNode } from "./load-icon-node";
import { PlaceholderIcon } from "./placeholder-icon";
import { UnknownIcon } from "./unknown-icon";

const fallback = <PlaceholderIcon />;

/**
 * The names of the icons.
 */
export const dynamicIconNames = new Set(lucideIconNames as DynamicIconName[]);

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const [iconNode, setIconNode] = useState<IconNode | null | undefined>(() => getCachedIconNode(name));

  useEffect(() => {
    if (!dynamicIconNames.has(name)) {
      setIconNode(null);
      return;
    }

    const cached = getCachedIconNode(name);

    if (cached) {
      setIconNode(cached);
      return;
    }

    setIconNode(undefined);

    let cancelled = false;

    // Resolution is funneled through a shared, concurrency-capped loader so a
    // grid of icons never fires a request per cell all at once.
    void loadIconNode(name).then(node => {
      if (!cancelled) {
        setIconNode(node);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!dynamicIconNames.has(name)) {
    return <Icon component={UnknownIcon} {...props} />;
  }

  if (iconNode === undefined) {
    return fallback;
  }

  if (iconNode === null) {
    return <Icon component={UnknownIcon} {...props} />;
  }

  return <Icon iconNode={iconNode} {...props} />;
}

export { type DynamicIconName, type DynamicIconProps } from "./props";
