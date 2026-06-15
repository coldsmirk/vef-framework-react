import type { LucideProps } from "lucide-react";

export function KeyboardReturnIcon({
  size = "1.2em",
  ...props
}: LucideProps) {
  return (
    <svg
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6l6 6l1.41-1.42L5.83 13H21V7z" fill="currentColor" />
    </svg>
  );
}
