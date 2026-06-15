import type { LucideProps } from "lucide-react";

export function KeyboardArrowUpIcon({
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
      <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6l-6 6z" fill="currentColor" />
    </svg>
  );
}
