import type { LucideProps } from "lucide-react";

export function KeyboardEscIcon({
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
      <path d="M6 7h12v2H6V7zm0 4h12v2H6v-2zm0 4h12v2H6v-2z" fill="currentColor" />
    </svg>
  );
}
