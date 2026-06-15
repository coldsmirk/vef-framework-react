import type { LucideProps } from "lucide-react";

export function UnknownIcon({
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
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
        <path d="M12 4h7c0.55 0 1 0.45 1 1v14c0 0.55 -0.45 1 -1 1h-14c-0.55 0 -1 -0.44 -1 -1v-14c0 -0.55 0.45 -1 1 -1Z" strokeDasharray={64} strokeDashoffset={64}><animate attributeName="stroke-dashoffset" dur="0.6s" fill="freeze" values="64;0" /></path>
        <path d="M9 10c0 -1.66 1.34 -3 3 -3c1.66 0 3 1.34 3 3c0 0.98 -0.47 1.85 -1.2 2.4c-0.73 0.55 -1.3 0.6 -1.8 1.6" strokeDasharray={16} strokeDashoffset={16}><animate attributeName="stroke-dashoffset" begin="0.6s" dur="0.2s" fill="freeze" values="16;0" /></path>
        <path d="M12 17v0.01" strokeDasharray={2} strokeDashoffset={2}><animate attributeName="stroke-dashoffset" begin="0.8s" dur="0.2s" fill="freeze" values="2;0" /></path>
      </g>
    </svg>
  );
}
