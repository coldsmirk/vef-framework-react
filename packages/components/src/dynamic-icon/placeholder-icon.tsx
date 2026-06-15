import type { LucideProps } from "lucide-react";

import { globalCssVars } from "../_base";

export function PlaceholderIcon({
  size = "1.2em",
  ...props
}: LucideProps) {
  return (
    <svg
      aria-label="Placeholder Icon"
      height={size}
      role="img"
      viewBox="0 0 100 100"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        fill={globalCssVars.colorFillContent}
        height="100"
        rx="20"
        width="100"
      />
    </svg>
  );
}
