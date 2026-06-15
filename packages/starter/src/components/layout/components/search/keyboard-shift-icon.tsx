import type { LucideProps } from "lucide-react";

export function KeyboardShiftIcon({
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
      <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8z" fill="currentColor" />
    </svg>
  );
}
