import type { LucideProps } from "lucide-react";

export function KeyboardControlIcon({
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
      <path d="m19.78 11.78l-1.42 1.41L12 6.83l-6.36 6.36l-1.42-1.41L12 4z" fill="currentColor" />
    </svg>
  );
}
