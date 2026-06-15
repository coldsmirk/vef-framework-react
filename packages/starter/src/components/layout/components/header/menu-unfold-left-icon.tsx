import type { LucideProps } from "lucide-react";

export function MenuUnfoldLeftIcon({
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
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="m21 9-3 3 3 3" strokeDasharray={10} strokeDashoffset={10}>
          <animate
            attributeName="stroke-dashoffset"
            dur="0.2s"
            fill="freeze"
            values="10;0"
          />
        </path>

        <path d="M19 5H5" strokeDasharray={16} strokeDashoffset={16}>
          <animate
            attributeName="stroke-dashoffset"
            begin="0.2s"
            dur="0.2s"
            fill="freeze"
            values="16;0"
          />
        </path>

        <path d="M14 12H5" strokeDasharray={10} strokeDashoffset={10}>
          <animate
            attributeName="stroke-dashoffset"
            begin="0.4s"
            dur="0.2s"
            fill="freeze"
            values="10;0"
          />
        </path>

        <path d="M19 19H5" strokeDasharray={16} strokeDashoffset={16}>
          <animate
            attributeName="stroke-dashoffset"
            begin="0.6s"
            dur="0.2s"
            fill="freeze"
            values="16;0"
          />
        </path>
      </g>
    </svg>
  );
}
